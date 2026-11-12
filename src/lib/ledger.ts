import { collection, getCountFromServer, query, where, type Firestore } from 'firebase/firestore';

/** 台帳（prtimes-inbox の companies）の件数。読むだけ */
export interface LedgerCounts {
  companies: number;
  withCorporateNumber: number;
}

export async function ledgerCounts(db: Firestore): Promise<LedgerCounts> {
  const companies = collection(db, 'companies');
  const [all, cn] = await Promise.all([
    getCountFromServer(companies),
    getCountFromServer(query(companies, where('corporateNumber', '>', ''))),
  ]);
  return { companies: all.data().count, withCorporateNumber: cn.data().count };
}
