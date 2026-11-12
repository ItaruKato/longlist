import { collection, getCountFromServer, query, where, type Firestore } from 'firebase/firestore';

/** 台帳（prtimes-inbox の companies）の件数。読むだけ */
export interface LedgerCounts {
  companies: number;
  withCorporateNumber: number;
  /** 厚生年金の加入者数（gbizInsured）が分かった会社 */
  withInsured: number;
  /** 有価証券報告書の財務（gbizFinance）がある会社 */
  withFinance: number;
}

export async function ledgerCounts(db: Firestore): Promise<LedgerCounts> {
  const companies = collection(db, 'companies');
  const [all, cn, insured, finance] = await Promise.all([
    getCountFromServer(companies),
    getCountFromServer(query(companies, where('corporateNumber', '>', ''))),
    getCountFromServer(query(companies, where('gbizInsured.total', '>=', 0))),
    getCountFromServer(query(companies, where('gbizFinance.period', '>', ''))),
  ]);
  return {
    companies: all.data().count,
    withCorporateNumber: cn.data().count,
    withInsured: insured.data().count,
    withFinance: finance.data().count,
  };
}
