import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, palette } from '@/components/ui';

export function AccessibleDialog({
  open,
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  confirmDisabled = false,
  danger = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="na-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      ref={dialogRef}
    >
      <div aria-hidden="true" className="na-dialog-handle" />
      <button
        aria-label="Cerrar"
        className="na-dialog-close"
        disabled={busy}
        onClick={onCancel}
        type="button"
      >
        ×
      </button>
      <View style={{ gap: 6, paddingRight: 46 }}>
        {eyebrow ? <Text selectable style={{ color: palette.greenDark, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 }}>{eyebrow.toUpperCase()}</Text> : null}
        <h2 id={titleId} style={{ color: palette.ink, fontSize: 22, fontWeight: 900, margin: 0 }}>{title}</h2>
        {description ? <Text nativeID={descriptionId} selectable style={{ color: palette.muted, lineHeight: 21 }}>{description}</Text> : null}
      </View>
      {children}
      <View style={{ gap: 9 }}>
        <ActionButton
          disabled={busy || confirmDisabled}
          label={confirmLabel}
          onPress={onConfirm}
          tone={danger ? 'danger' : 'primary'}
        />
        <ActionButton disabled={busy} label={cancelLabel} onPress={onCancel} tone="secondary" />
      </View>
    </dialog>
  );
}
