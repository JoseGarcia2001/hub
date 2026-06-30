import assert from "node:assert/strict";
import { parseStatementXml } from "./flex";

/**
 * Self-check del parser Flex (sin red ni DB). Verifica lo no trivial:
 * conversión a USD vía fxRateToBase, agregados (NAV/cash/P&L), pesos, fecha,
 * y el caso de UNA sola posición (fast-xml-parser entrega objeto, no array).
 * Correr:  pnpm --filter @hub/core selfcheck
 */

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="Hub" type="AF">
  <FlexStatements count="1">
    <FlexStatement accountId="U-TEST" fromDate="20260629" toDate="20260629">
      <EquitySummaryInBase>
        <EquitySummaryByReportDateInBase reportDate="20260629" cash="500" stock="2000" total="2500" />
      </EquitySummaryInBase>
      <OpenPositions>
        <OpenPosition conid="1" symbol="NU" description="NU HOLDINGS" position="100" currency="USD" fxRateToBase="1" markPrice="10" positionValue="1000" costBasisPrice="8" fifoPnlUnrealized="200" />
        <OpenPosition conid="2" symbol="1211" description="BYD" position="100" currency="HKD" fxRateToBase="0.5" markPrice="20" positionValue="2000" costBasisPrice="24" fifoPnlUnrealized="-300" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

const s = parseStatementXml(xml);
assert.equal(s.accountId, "U-TEST");
assert.equal(s.netLiquidation, 2500);
assert.equal(s.cash, 500);
assert.equal(s.positionsValue, 2000); // 1000 USD + (2000 HKD × 0.5)
assert.equal(s.unrealizedPnl, 50); // 200 + (-300 × 0.5)
assert.ok(Math.abs(s.unrealizedPnlPct - (50 / 1950) * 100) < 1e-9);
assert.equal(s.asOf, "2026-06-29T00:00:00.000Z");
assert.equal(s.positions.length, 2);

const hkd = s.positions.find((p) => p.conid === 2);
assert.ok(hkd, "falta la posición HKD");
assert.equal(hkd.currency, "HKD");
assert.equal(hkd.marketValueBase, 1000); // 2000 HKD × 0.5 → prueba la conversión FX
assert.equal(hkd.unrealizedPnlBase, -150); // -300 × 0.5
assert.equal(hkd.costBasisBase, 1150); // 1000 − (−150)
assert.equal(hkd.weightPct, 50);

// Caso de una sola posición: fast-xml-parser entrega objeto (no array).
const xml1 = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U-1">
  <EquitySummaryInBase><EquitySummaryByReportDateInBase reportDate="20260101" cash="0" total="500" /></EquitySummaryInBase>
  <OpenPositions><OpenPosition conid="9" symbol="X" position="5" currency="USD" fxRateToBase="1" positionValue="500" fifoPnlUnrealized="0" /></OpenPositions>
</FlexStatement></FlexStatements></FlexQueryResponse>`;
const s1 = parseStatementXml(xml1);
assert.equal(s1.positions.length, 1);
assert.equal(s1.positions[0].marketValueBase, 500);
assert.equal(s1.positionsValue, 500);

console.log("✓ flex.selfcheck: parseo XML + conversión FX + agregados + caso 1-posición OK");
