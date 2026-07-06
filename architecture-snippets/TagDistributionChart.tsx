import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { Typography } from '@/src/theme/typography';
import { Spacing, BorderRadius } from '@/src/theme/spacing';

interface TagData {
  tagId: string | null;
  tagName: string;
  tagColor: string;
  totalFocus: number;
}

interface TagDistributionChartProps {
  data: TagData[];
}

export default function TagDistributionChart({ data }: TagDistributionChartProps) {
  const { colors, isDark } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.title, { color: colors.text }]}>Foco por Tag</Text>
        <Text style={{ color: colors.textTertiary, marginTop: Spacing.md }}>Nenhum dado de foco no período.</Text>
      </View>
    );
  }

  // Calculate total focus to determine percentages
  const totalFocusAll = data.reduce((sum, item) => sum + item.totalFocus, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.title, { color: colors.text }]}>Foco por Categoria</Text>
      
      {/* Visual Stacked Bar representation (overall proportion) */}
      <View style={[styles.stackedBar, { backgroundColor: isDark ? '#333' : '#EAEAEA' }]}>
        {data.map((item, index) => {
          const percent = (item.totalFocus / totalFocusAll) * 100;
          return (
            <View
              key={`stack-${item.tagId || 'none'}-${index}`}
              style={{
                width: `${percent}%`,
                backgroundColor: item.tagColor,
                height: '100%',
              }}
            />
          );
        })}
      </View>

      {/* Individual Bars and Legends */}
      <View style={styles.listContainer}>
        {data.map((item, index) => {
          const percent = (item.totalFocus / totalFocusAll) * 100;
          const minutes = Math.round(item.totalFocus / 60);
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

          return (
            <View key={`row-${item.tagId || 'none'}-${index}`} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.labelGroup}>
                  <View style={[styles.dot, { backgroundColor: item.tagColor }]} />
                  <Text style={[styles.tagName, { color: colors.text }]} numberOfLines={1}>
                    {item.tagName}
                  </Text>
                </View>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {timeStr} <Text style={{ color: colors.textTertiary }}>({Math.round(percent)}%)</Text>
                </Text>
              </View>
              
              <View style={[styles.barTrack, { backgroundColor: isDark ? '#2D2D2D' : '#F0F0F0' }]}>
                <View style={[styles.barFill, { backgroundColor: item.tagColor, width: `${percent}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.bodySemiBold,
    marginBottom: Spacing.md,
  },
  stackedBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  listContainer: {
    gap: Spacing.md,
  },
  row: {
    gap: Spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tagName: {
    ...Typography.bodyMedium,
  },
  timeText: {
    ...Typography.captionMedium,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
