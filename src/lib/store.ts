/**
 * 기록. 구매 한 건에 대해 요청·후보·점수·탈락 사유·금액·거래번호·결과를 남긴다.
 *
 * SQLite 파일 하나(data/agent-m2m.db)에 저장한다. 화면은 이 파일을 직접 열지 않고
 * 이 모듈의 함수만 쓴다. 한 번 저장한 줄은 고치지 않는다(덧붙이기만).
 */

import Database from "better-sqlite3";
import path from "node:path";

import type { Decision, PaymentResult, PurchaseRecord, PurchaseStatus } from "./types";

const DB_PATH = process.env.AGENT_M2M_DB ?? path.join(process.cwd(), "data", "agent-m2m.db");

let cached: Database.Database | null = null;

function db(): Database.Database {
  if (cached !== null) return cached;
  const instance = new Database(DB_PATH);
  instance.pragma("journal_mode = WAL");
  instance.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      decision_json TEXT NOT NULL,
      payment_json TEXT,
      result_text TEXT,
      failure_reason TEXT
    );
  `);
  cached = instance;
  return instance;
}

interface Row {
  id: string;
  created_at: string;
  prompt: string;
  status: string;
  decision_json: string;
  payment_json: string | null;
  result_text: string | null;
  failure_reason: string | null;
}

function toRecord(row: Row): PurchaseRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    prompt: row.prompt,
    status: row.status as PurchaseStatus,
    decision: JSON.parse(row.decision_json) as Decision,
    payment: row.payment_json === null ? null : (JSON.parse(row.payment_json) as PaymentResult),
    resultText: row.result_text,
    failureReason: row.failure_reason,
  };
}

export function savePurchase(record: PurchaseRecord): void {
  db()
    .prepare(
      `INSERT INTO purchases
         (id, created_at, prompt, status, decision_json, payment_json, result_text, failure_reason)
       VALUES (@id, @createdAt, @prompt, @status, @decisionJson, @paymentJson, @resultText, @failureReason)`,
    )
    .run({
      id: record.id,
      createdAt: record.createdAt,
      prompt: record.prompt,
      status: record.status,
      decisionJson: JSON.stringify(record.decision),
      paymentJson: record.payment === null ? null : JSON.stringify(record.payment),
      resultText: record.resultText,
      failureReason: record.failureReason,
    });
}

export function listPurchases(limit = 50): PurchaseRecord[] {
  const rows = db()
    .prepare(`SELECT * FROM purchases ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as Row[];
  return rows.map(toRecord);
}

export function getPurchase(id: string): PurchaseRecord | null {
  const row = db().prepare(`SELECT * FROM purchases WHERE id = ?`).get(id) as Row | undefined;
  return row === undefined ? null : toRecord(row);
}

/** 같은 구매 번호로 결제가 두 번 일어나지 않게 하는 확인. */
export function purchaseExists(id: string): boolean {
  const row = db().prepare(`SELECT 1 FROM purchases WHERE id = ?`).get(id);
  return row !== undefined;
}
