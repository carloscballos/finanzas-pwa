// Matemática de amortización francesa (cuota constante), que es como los
// bancos en Colombia liquidan un crédito de consumo. Verificado contra un
// extracto real de BBVA: interés del período = saldo de capital × tasa
// mensual; capital = (cuota − seguro) − interés; el saldo solo baja por el
// capital. La misma matemática vive en apps/web/src/lib/money.ts para el
// botón "Estimar cuota" del formulario — si se toca una, revisar la otra.

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Los bancos cotizan la tasa efectiva anual (E.A.); la tasa mensual
// equivalente es (1 + EA)^(1/12) − 1 — NO EA/12 (eso sería nominal).
export function monthlyRateFromAnnualEffective(annualEffectivePercent: number | null | undefined): number {
  if (!annualEffectivePercent || annualEffectivePercent <= 0) return 0;
  return Math.pow(1 + annualEffectivePercent / 100, 1 / 12) - 1;
}

export interface InstallmentSplit {
  interest: number;
  principal: number;
  insurance: number;
  total: number;
}

// Reparto de la PRÓXIMA cuota dado el saldo actual. `fixedPortion` es la
// parte constante de la cuota (capital + interés = installmentAmount −
// insuranceAmount). En la última cuota el capital se recorta al saldo, así
// que el total puede ser menor que la cuota normal.
export function splitNextInstallment(
  remainingBalance: number,
  monthlyRate: number,
  fixedPortion: number,
  insurance: number,
): InstallmentSplit {
  if (remainingBalance <= 0) return { interest: 0, principal: 0, insurance: 0, total: 0 };
  const interest = round2(remainingBalance * monthlyRate);
  const principal = round2(Math.min(remainingBalance, Math.max(0, fixedPortion - interest)));
  const insuranceRounded = round2(Math.max(0, insurance));
  return { interest, principal, insurance: insuranceRounded, total: round2(interest + principal + insuranceRounded) };
}

// Saldo de capital después de `paidCount` cuotas del plan, para importar un
// préstamo en curso sin el saldo exacto del extracto. Con tasa 0 degenera a
// principal − paidCount × fixedPortion (el modelo viejo).
export function projectRemainingBalance(
  principal: number,
  monthlyRate: number,
  fixedPortion: number,
  paidCount: number,
): number {
  let balance = principal;
  for (let k = 0; k < paidCount && balance > 0; k++) {
    const { principal: capital } = splitNextInstallment(balance, monthlyRate, fixedPortion, 0);
    balance = round2(balance - capital);
  }
  return Math.max(0, balance);
}
