import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

export const palette = {
  navy: '#071a2f',
  navySoft: '#12304e',
  green: '#24c978',
  greenDark: '#11784b',
  mint: '#dcf8ea',
  paper: '#ffffff',
  background: '#f4f7f5',
  ink: '#0d1f2d',
  muted: '#64727c',
  border: '#dce5df',
  warning: '#9a5b00',
  warningBackground: '#fff2d8',
  danger: '#a63333',
  dangerBackground: '#fde8e8',
};

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View
      style={[
        {
          backgroundColor: palette.paper,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 18,
          gap: 14,
          boxShadow: '0 10px 30px rgba(7, 26, 47, 0.06)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, eyebrow }: PropsWithChildren<{ eyebrow?: string }>) {
  return (
    <View style={{ gap: 4 }}>
      {eyebrow ? (
        <Text selectable style={{ color: palette.greenDark, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <Text selectable style={{ color: palette.ink, fontSize: 20, fontWeight: '800' }}>
        {children}
      </Text>
    </View>
  );
}

export function ActionButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  tone = 'primary',
  icon,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
}) {
  const colors = tone === 'primary'
    ? { background: palette.navy, foreground: '#ffffff', border: palette.navy }
    : tone === 'danger'
      ? { background: palette.dangerBackground, foreground: palette.danger, border: '#f3c2c2' }
      : { background: '#ffffff', foreground: palette.navy, border: palette.border };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      })}
    >
      {icon}
      <Text selectable style={{ color: colors.foreground, fontWeight: '800', fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'good' | 'warning' | 'neutral' }) {
  const colors = tone === 'good'
    ? { background: palette.mint, foreground: palette.greenDark }
    : tone === 'warning'
      ? { background: palette.warningBackground, foreground: palette.warning }
      : { background: '#e9eef2', foreground: palette.navySoft };
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.background }}>
      <Text selectable style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}
