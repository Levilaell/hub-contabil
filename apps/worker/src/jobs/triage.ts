import type { ClassificationAdapter } from '@hub/adapters';
import { parseFirmConfig } from '@hub/config';
import { decideTriage, parseNfe, routeDepartment } from '@hub/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';

import type { TriagePayload } from '../queue/payloads.js';

// AI triage pipeline (T20). A functional pipeline (deliberately not LangGraph — see
// memory) of node steps: extract_text → classify → resolve_company → route → decide
// → file | exception. XML (NF-e) bypasses the LLM via the deterministic core parser
// (golden rule #4). The AI never decides alone: low confidence, an unknown company,
// or an unroutable type fall to the exception queue with a pre-filled suggestion
// (golden rule #5). Runs as the service role, so every query carries firm_id (#1).
// A failed step throws → runner retry/backoff → DLQ → exception queue (#6).

const BUCKET = 'documents';

function mediaTypeFor(fileName: string): string | null {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return null;
}

interface DocRow {
  id: string;
  company_id: string;
  file_name: string;
  doc_type: string;
  storage_path: string;
  period: string | null;
  department: string | null;
}

export function createTriageHandler(
  sql: Sql,
  storage: SupabaseClient,
  classifier: ClassificationAdapter,
) {
  const json = (value: unknown) => sql.json(value as Parameters<typeof sql.json>[0]);

  return async function handle(payload: TriagePayload): Promise<void> {
    const { firm_id, document_id } = payload;

    const [doc] = await sql<DocRow[]>`
      select id, company_id, file_name, doc_type, storage_path, period, department
      from public.documents
      where id = ${document_id} and firm_id = ${firm_id}
    `;
    if (!doc) {
      console.warn(`[triage] document ${document_id} not found in firm ${firm_id}; skipping`);
      return;
    }

    const [firm] = await sql<{ config: unknown }[]>`
      select config from public.firms where id = ${firm_id}
    `;
    const config = parseFirmConfig(firm?.config);

    // Few-shot: the firm's own confirmed corrections steer borderline cases
    // (golden rule #5 — human resolutions feed back examples).
    const examples = await sql<{ doc_type: string; file_name: string | null }[]>`
      select e.doc_type, coalesce(d.file_name, e.context->>'fileName') as file_name
      from public.classification_examples e
      left join public.documents d on d.id = e.document_id and d.firm_id = e.firm_id
      where e.firm_id = ${firm_id}
      order by e.created_at desc
      limit 12
    `;
    const fewShot = examples.map((e) => ({ fileName: e.file_name, docType: e.doc_type }));

    // --- extract_text + classify ---
    const departmentKeys = config.departments.map((d) => d.key);
    let docType = 'other';
    let confidence = 0;
    let cnpj: string | null = null;
    let aiDepartment: string | null = null;

    if (doc.file_name.toLowerCase().endsWith('.xml')) {
      // NF-e: deterministic parser, NO LLM.
      const { data, error } = await storage.storage.from(BUCKET).download(doc.storage_path);
      if (error || !data) throw new Error(`download failed for ${doc.storage_path}`);
      const xmlText = await data.text();
      const parsed = parseNfe(xmlText);
      if (parsed.isNfe) {
        docType = 'nfe';
        confidence = 1;
        cnpj = parsed.issuerCnpj;
      } else {
        // Non-NF-e XML (NFS-e, CT-e…): fall back to the LLM over the XML text
        // instead of dumping straight to a human as "other".
        const result = await classifier.classify({
          taxonomy: config.taxonomy,
          fileName: doc.file_name,
          model: config.aiModel,
          text: xmlText,
          examples: fewShot,
          departments: departmentKeys,
        });
        docType = result.docType;
        confidence = result.confidence;
        cnpj = result.cnpj;
        aiDepartment = result.department;
      }
    } else {
      const mediaType = mediaTypeFor(doc.file_name);
      if (mediaType) {
        const { data, error } = await storage.storage.from(BUCKET).download(doc.storage_path);
        if (error || !data) throw new Error(`download failed for ${doc.storage_path}`);
        const base64 = Buffer.from(await data.arrayBuffer()).toString('base64');
        const result = await classifier.classify({
          taxonomy: config.taxonomy,
          fileName: doc.file_name,
          model: config.aiModel,
          media: { mediaType, base64 },
          examples: fewShot,
          departments: departmentKeys,
        });
        docType = result.docType;
        confidence = result.confidence;
        cnpj = result.cnpj;
        aiDepartment = result.department;
      }
      // unsupported type for auto-triage stays other/0 → human
    }

    // --- resolve_company (by extracted CNPJ) ---
    let companyFound = false;
    let resolvedCompanyId: string | null = null;
    if (cnpj) {
      const [company] = await sql<{ id: string }[]>`
        select id from public.companies where firm_id = ${firm_id} and cnpj = ${cnpj}
      `;
      if (company) {
        companyFound = true;
        resolvedCompanyId = company.id;
      }
    }

    // --- route + decide ---
    // Deterministic firm rule first (routingMap); for content-dependent types
    // (boleto, comprovante, planilha — partner decision, Fase 1.1) fall back to
    // the department the classifier read from the document itself. The global
    // confidence threshold still gates the whole decision (golden rule #5).
    const department = routeDepartment(config.routingMap, docType) ?? aiDepartment;
    const outcome = decideTriage({
      confidence,
      threshold: config.aiThreshold,
      companyFound,
      department,
    });

    // Record the AI's classification either way (badge + future few-shot, T21).
    await sql`
      insert into public.classifications
        (firm_id, document_id, suggested_type, extracted_cnpj, confidence, model, decided_by)
      values (${firm_id}, ${document_id}, ${docType}, ${cnpj}, ${confidence}, ${config.aiModel}, 'ai')
      on conflict (firm_id, document_id) do update set
        suggested_type = excluded.suggested_type,
        extracted_cnpj = excluded.extracted_cnpj,
        confidence = excluded.confidence,
        model = excluded.model,
        decided_by = 'ai'
    `;

    if (outcome.decision === 'file') {
      // Inbox docs arrive with company_id null; set the resolved company (keep an
      // existing one for normal uploads). coalesce: never overwrite a real company.
      await sql`
        update public.documents
        set doc_type = ${docType}, department = ${department},
            company_id = coalesce(company_id, ${resolvedCompanyId})
        where id = ${document_id} and firm_id = ${firm_id}
      `;
      await sql`
        insert into public.audit_events (firm_id, action, entity, entity_id, context)
        values (${firm_id}, 'document.classified', 'document', ${document_id},
                ${json({ docType, department, confidence, model: config.aiModel })})
      `;
      console.log(`[triage] filed ${document_id} as ${docType} → ${department ?? '?'}`);
    } else {
      await sql`
        insert into public.exception_queue (firm_id, source, context, suggestion)
        values (
          ${firm_id}, 'triage',
          ${json({
            documentId: document_id,
            fileName: doc.file_name,
            reason: outcome.reason,
            suggestedType: docType,
            cnpj,
            confidence,
          })},
          ${json({ docType, department, cnpj })}
        )
      `;
      await sql`
        insert into public.audit_events (firm_id, action, entity, entity_id, context)
        values (${firm_id}, 'triage.exception', 'document', ${document_id},
                ${json({ reason: outcome.reason, docType, confidence })})
      `;
      console.log(`[triage] ${document_id} → exception (${outcome.reason})`);
    }
  };
}
