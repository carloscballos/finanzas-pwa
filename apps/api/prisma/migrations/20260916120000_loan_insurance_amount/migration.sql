-- Préstamos con amortización real: seguro/cargos fijos por cuota. El resto
-- del cambio (interestRate pasa a usarse como tasa efectiva anual en el
-- reparto capital/interés de cada pago) es solo de lógica, no de schema.
ALTER TABLE "loans" ADD COLUMN "insuranceAmount" DECIMAL(14,2);
