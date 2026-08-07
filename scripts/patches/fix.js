import * as fs from 'fs';

const p = './src/components/FinanceLedgerPanel.tsx';
let txt = fs.readFileSync(p, 'utf8');

const anchor1 = '{activeTab === "ministry_ledgers" && (';
const anchor2 = '{/* 8. MODAL: Manual Disbursement Settlement Form */}';

const i1 = txt.indexOf(anchor1);
const i2 = txt.indexOf(anchor2);

if (i1 > -1 && i2 > -1) {
    fs.writeFileSync(p, txt.substring(0, i1) + txt.substring(i2));
    console.log("Replaced block");
} else {
    console.log("Missing anchors", i1, i2);
}
