import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, palette } from '@/components/ui';
import type { ViabilityRecord } from '@/storage/dataset-types';

export function TestRecordForm({
  record,
  disabled,
  onSave,
}: {
  record: ViabilityRecord | null;
  disabled?: boolean;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(record?.text ?? 'Registro ficticio para comprobar la persistencia');

  useEffect(() => {
    if (record) setText(record.text);
  }, [record]);

  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: palette.muted, fontSize: 13 }}>
        Identificador fijo: registro-prueba-001
      </Text>
      <TextInput
        accessibilityLabel="Texto del registro ficticio"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Escribe un texto ficticio"
        placeholderTextColor="#87939b"
        style={{
          minHeight: 96,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 14,
          color: palette.ink,
          backgroundColor: '#f9fbfa',
          textAlignVertical: 'top',
          fontSize: 16,
        }}
      />
      <ActionButton
        label={record ? 'Guardar cambios' : 'Crear registro ficticio'}
        disabled={disabled || !text.trim()}
        onPress={() => void onSave(text)}
      />
      {record ? (
        <Text selectable style={{ color: palette.greenDark, fontSize: 13 }}>
          Guardado localmente · {new Date(record.updatedAt).toLocaleString('es-ES')}
        </Text>
      ) : null}
    </View>
  );
}
