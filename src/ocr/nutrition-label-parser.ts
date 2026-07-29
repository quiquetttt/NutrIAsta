import type {
  DetectedNutritionValue,
  NutritionBasis,
  NutritionColumn,
  NutritionFieldKey,
  NutritionLabelResult,
} from '@/ocr/nutrition-label-types';

const FIELD_DEFINITIONS: Array<{
  key: NutritionFieldKey;
  label: string;
  unit: 'kJ' | 'kcal' | 'g';
  matches: (line: string) => boolean;
}> = [
  { key: 'energyKj', label: 'Energía', unit: 'kJ', matches: (line) => /energ|valor energ/.test(line) && /\bkj\b/i.test(line) },
  { key: 'energyKcal', label: 'Energía', unit: 'kcal', matches: (line) => /\bkcal\b/i.test(line) },
  { key: 'fatG', label: 'Grasas', unit: 'g', matches: (line) => /grasas?|l[ií]pidos?/.test(line) && !/saturad|monoinsatur|poliinsatur/.test(line) },
  { key: 'carbohydratesG', label: 'Hidratos de carbono', unit: 'g', matches: (line) => /hidratos?\s+de\s+carbono|carbohidratos?/.test(line) && !/az[uú]car/.test(line) },
  { key: 'proteinG', label: 'Proteínas', unit: 'g', matches: (line) => /prote[ií]nas?/.test(line) },
];

function normalized(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-ES');
}

function numberTokens(line: string) {
  return [...line.matchAll(/(?<![\p{L}\d])(-?[\dOIS]+(?:[.,][\dOIS]+)?)(?:\s*)(kcal|kJ|kj|mg|ml|g)?\b/giu)].map((match) => {
    const numeric = (match[1] ?? '')
      .replace(/[oO]/g, '0')
      .replace(/[iI]/g, '1')
      .replace(/[sS]/g, '5')
      .replace(',', '.');
    return {
      raw: match[0].trim(),
      value: Number(numeric),
      unit: match[2]?.toLocaleLowerCase(),
    };
  });
}

function columnsFromText(text: string): NutritionColumn[] {
  const header = text.split(/\r?\n/).find((line) => /por\s*100|porci[oó]n|raci[oó]n/i.test(line)) ?? '';
  const normalizedHeader = normalized(header);
  const columns: NutritionColumn[] = [];
  if (/100\s*g\b/.test(normalizedHeader)) columns.push({ id: 'per-100-g', label: 'Por 100 g', basis: 'per-100-g', portionAmount: null, portionUnit: null });
  if (/100\s*ml\b/.test(normalizedHeader)) columns.push({ id: 'per-100-ml', label: 'Por 100 ml', basis: 'per-100-ml', portionAmount: null, portionUnit: null });
  const portion = normalizedHeader.match(/(?:porci[oó]n|raci[oó]n)(?:\s+de)?\s*(\d+(?:[.,]\d+)?)?\s*(g|ml)?/i);
  if (/porci[oó]n|raci[oó]n/.test(normalizedHeader)) {
    columns.push({
      id: 'portion',
      label: portion?.[1] ? `Por porción de ${portion[1]} ${portion[2] ?? ''}`.trim() : 'Por porción',
      basis: 'portion',
      portionAmount: portion?.[1] ? Number(portion[1].replace(',', '.')) : null,
      portionUnit: portion?.[2] === 'g' || portion?.[2] === 'ml' ? portion[2] : null,
    });
  }
  return columns.length ? columns : [{ id: 'unknown', label: 'Columna sin identificar', basis: 'unknown', portionAmount: null, portionUnit: null }];
}

function expectedUnit(key: NutritionFieldKey) {
  return key === 'energyKj' ? 'kj' : key === 'energyKcal' ? 'kcal' : 'g';
}

function valueWarnings(key: NutritionFieldKey, value: number, unit: string | undefined, basis: NutritionBasis, raw: string) {
  const warnings: string[] = [];
  if (!Number.isFinite(value)) warnings.push('El valor no es numérico.');
  if (value < 0) warnings.push('La cantidad es negativa.');
  const expected = expectedUnit(key);
  if (unit && unit !== expected) warnings.push(`La unidad ${unit} no coincide con ${expected}.`);
  if (key.endsWith('G') && value > 100) warnings.push(basis === 'portion' ? 'El valor por porción parece improbable.' : 'El valor por 100 parece improbable.');
  if ((key === 'energyKcal' && value > 2000) || (key === 'energyKj' && value > 10000)) warnings.push('El valor energético parece improbable.');
  if (/[OIS]/.test(raw)) warnings.push('El OCR contiene caracteres ambiguos O/0, I/1 o S/5.');
  return warnings;
}

export function parseNutritionLabel(recognizedText: string, confidence = 0): NutritionLabelResult {
  const text = recognizedText.slice(0, 50_000);
  const columns = columnsFromText(text);
  const values: DetectedNutritionValue[] = [];
  const warnings: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalized(rawLine);
    const definition = FIELD_DEFINITIONS.find((candidate) => candidate.matches(line));
    if (!definition) continue;
    let tokens = numberTokens(rawLine);
    if (definition.key === 'energyKj') tokens = tokens.filter(({ unit }) => unit === 'kj');
    if (definition.key === 'energyKcal') tokens = tokens.filter(({ unit }) => unit === 'kcal');
    if (definition.key.endsWith('G')) tokens = tokens.filter(({ unit }) => unit !== 'kcal' && unit !== 'kj');
    tokens.slice(0, columns.length).forEach((token, index) => {
      const column = columns[index] ?? columns[0]!;
      const converted = token.unit === 'mg' ? token.value / 1000 : token.value;
      const fieldWarnings = valueWarnings(definition.key, converted, token.unit === 'mg' ? 'g' : token.unit, column.basis, token.raw);
      values.push({
        key: definition.key,
        label: definition.label,
        value: Number.isFinite(converted) ? converted : null,
        unit: definition.unit,
        columnId: column.id,
        columnLabel: column.label,
        raw: token.raw,
        confidence,
        status: confidence >= 75 && fieldWarnings.length === 0 ? 'detected' : 'uncertain',
        warnings: fieldWarnings,
      });
    });
  }
  for (const column of columns) {
    for (const definition of FIELD_DEFINITIONS) {
      if (!values.some((value) => value.columnId === column.id && value.key === definition.key)) {
        values.push({
          key: definition.key,
          label: definition.label,
          value: null,
          unit: definition.unit,
          columnId: column.id,
          columnLabel: column.label,
          raw: '',
          confidence,
          status: 'missing',
          warnings: [],
        });
      }
    }
  }
  for (const column of columns) {
    const kcal = values.find((value) => value.columnId === column.id && value.key === 'energyKcal')?.value;
    const kj = values.find((value) => value.columnId === column.id && value.key === 'energyKj')?.value;
    if (kcal && kj && Math.abs(kj / kcal - 4.184) > 0.85) warnings.push(`${column.label}: kcal y kJ no parecen corresponder.`);
    if (column.basis === 'unknown') warnings.push('La base nutricional no está clara.');
    const present = values.filter((value) => value.columnId === column.id && value.value !== null).length;
    if (present > 0 && present < FIELD_DEFINITIONS.length) warnings.push(`${column.label}: la columna está incompleta.`);
  }
  if (columns.length > 1 && values.some((value) => value.value !== null) && columns.some((column) => !values.some((value) => value.columnId === column.id && value.value !== null))) {
    warnings.push('Las columnas detectadas no tienen una estructura coherente.');
  }
  return { columns, values, recognizedText: text, confidence, warnings: [...new Set(warnings)] };
}
