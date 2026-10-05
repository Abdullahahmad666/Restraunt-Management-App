/**
 * What the restaurant buys, from whom, into where, and what it costs.
 *
 * One set of filters drives all three figures on this screen - the totals, the
 * chart and the per-product table - so they always describe the same thing. A
 * chart that disagrees with the table beneath it is worse than no chart.
 */
import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {BarChart} from '../../../components/BarChart';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {PickerRow} from '../../../components/PickerRow';
import {PickerSheet} from '../../../components/PickerSheet';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {describeApiError} from '../../../api/errors';
import {
  usePurchaseSummary,
  usePurchaseTimeline,
  usePurchasesByItem,
  useSuppliers,
  useWarehouses,
} from '../../../features/inventory/hooks';
import type {
  PurchaseByItem,
  PurchaseFilters,
  PurchasePeriod,
} from '../../../features/inventory/types';
import {colors, spacing} from '../../../theme';
import {formatCurrency, formatDate} from '../../../utils/format';

const PERIODS: SegmentedOption<PurchasePeriod>[] = [
  {value: 'week', label: 'Weekly'},
  {value: 'month', label: 'Monthly'},
];

/** How far back the screen looks by default. Long enough to see a trend,
 * short enough that the first load is not a year of rows. */
const DEFAULT_MONTHS_BACK = 6;

/** The "no filter" choice. A picker needs a value behind every row, and an id
 * no restaurant can own is cheaper than making the whole sheet nullable. */
const ALL = '__all__';

function isoMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}

function ItemRow({row}: {row: PurchaseByItem}): React.JSX.Element {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{row.item_name}</Text>
        <Text style={styles.itemSpend}>{formatCurrency(row.total_spend)}</Text>
      </View>
      <Text style={styles.hint}>
        {row.total_quantity} {row.item_unit} across {row.invoice_count}{' '}
        {row.invoice_count === 1 ? 'invoice' : 'invoices'}
        {row.last_purchased ? ` · last ${formatDate(row.last_purchased)}` : ''}
      </Text>
      {row.lines_without_price > 0 ? (
        <Text style={styles.warning}>
          {row.lines_without_price} {row.lines_without_price === 1 ? 'line' : 'lines'} had no
          readable price, so this total is lower than it should be.
        </Text>
      ) : null}
    </Card>
  );
}

export function PurchaseHistoryScreen(): React.JSX.Element {
  const [period, setPeriod] = useState<PurchasePeriod>('month');
  const [supplier, setSupplier] = useState<string | undefined>();
  const [warehouse, setWarehouse] = useState<string | undefined>();
  const [picking, setPicking] = useState<'supplier' | 'warehouse' | null>(null);

  const filters: PurchaseFilters = useMemo(
    () => ({supplier, warehouse, date_from: isoMonthsAgo(DEFAULT_MONTHS_BACK)}),
    [supplier, warehouse],
  );

  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const supplierList = suppliers.data?.results ?? [];
  const warehouseList = warehouses.data?.results ?? [];
  const supplierName = supplierList.find(row => row.id === supplier)?.name;
  const warehouseName = warehouseList.find(row => row.id === warehouse)?.name;
  const summary = usePurchaseSummary(filters);
  const timeline = usePurchaseTimeline(period, filters);
  const byItem = usePurchasesByItem(filters);

  if (summary.isLoading || timeline.isLoading || byItem.isLoading) {
    return <LoadingView />;
  }

  const failure = summary.error ?? timeline.error ?? byItem.error;
  if (failure) {
    return (
      <ErrorState
        message={describeApiError(failure, 'Could not load purchase history.')}
        onRetry={() => {
          summary.refetch();
          timeline.refetch();
          byItem.refetch();
        }}
      />
    );
  }

  const totals = summary.data;
  const rows = byItem.data?.results ?? [];
  const buckets = timeline.data?.results ?? [];

  const chartData = buckets.map(bucket => ({
    label: bucket.bucket ? formatDate(bucket.bucket) : '—',
    value: Number(bucket.total_spend),
  }));

  function onRefresh() {
    summary.refetch();
    timeline.refetch();
    byItem.refetch();
  }

  return (
    <Screen
      onRefresh={onRefresh}
      refreshing={summary.isRefetching || timeline.isRefetching || byItem.isRefetching}>
      <Text style={styles.hint}>
        Confirmed invoices from the last {DEFAULT_MONTHS_BACK} months.
      </Text>

      {/*
        Two filters, each named and each saying what it is set to - rather than
        two rows of chips that grew a row longer with every supplier the
        restaurant had ever bought from, and never said which row was which.
      */}
      <View style={styles.filters}>
        <PickerRow
          icon={supplier ? 'business' : 'business-outline'}
          tone="done"
          title={supplierName ?? 'All suppliers'}
          hint="Supplier"
          actionLabel={supplier ? 'Change' : 'Filter'}
          onPress={() => setPicking('supplier')}
        />
        {warehouseList.length > 0 ? (
          <PickerRow
            icon={warehouse ? 'location' : 'location-outline'}
            tone="done"
            title={warehouseName ?? 'Everywhere'}
            hint="Delivered to"
            actionLabel={warehouse ? 'Change' : 'Filter'}
            onPress={() => setPicking('warehouse')}
          />
        ) : null}
      </View>

      <PickerSheet
        visible={picking === 'supplier'}
        title="Filter by supplier"
        searchPlaceholder="Search suppliers"
        choices={[
          {value: ALL, label: 'All suppliers'},
          ...supplierList.map(row => ({value: row.id, label: row.name})),
        ]}
        selected={supplier ?? ALL}
        onSelect={value => setSupplier(value === ALL ? undefined : value)}
        onClose={() => setPicking(null)}
      />

      <PickerSheet
        visible={picking === 'warehouse'}
        title="Filter by storage area"
        searchPlaceholder="Search storage areas"
        choices={[
          {value: ALL, label: 'Everywhere'},
          ...warehouseList.map(row => ({value: row.id, label: row.name})),
        ]}
        selected={warehouse ?? ALL}
        onSelect={value => setWarehouse(value === ALL ? undefined : value)}
        onClose={() => setPicking(null)}
      />

      {totals ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryValue}>{formatCurrency(totals.total_spend)}</Text>
              <Text style={styles.hint}>Goods</Text>
            </View>
            <View>
              <Text style={styles.summaryValue}>{totals.invoice_count}</Text>
              <Text style={styles.hint}>Invoices</Text>
            </View>
            <View>
              <Text style={styles.summaryValue}>{totals.item_count}</Text>
              <Text style={styles.hint}>Products</Text>
            </View>
          </View>

          {/* The product figures on this screen are what the goods cost -
              every one of them comes from the lines, and VAT is not on a line.
              Showing it beside them, with what the two come to, is the
              difference between what was bought and what was paid. */}
          {Number(totals.tax_total) > 0 ? (
            <View style={styles.taxRow}>
              <Text style={styles.taxLabel}>
                VAT on {totals.invoices_stating_tax} of {totals.invoice_count} invoice
                {totals.invoice_count === 1 ? '' : 's'}
              </Text>
              <Text style={styles.taxValue}>{formatCurrency(totals.tax_total)}</Text>
            </View>
          ) : null}
          {Number(totals.tax_total) > 0 ? (
            <View style={styles.taxRow}>
              <Text style={styles.paidLabel}>Paid out</Text>
              <Text style={styles.paidValue}>
                {formatCurrency(Number(totals.total_spend) + Number(totals.tax_total))}
              </Text>
            </View>
          ) : null}

          {/* Said out loud rather than left to make the total quietly wrong. */}
          {totals.lines_without_price > 0 ? (
            <Text style={styles.warning}>
              {totals.lines_without_price} lines had no readable price and are not in this total.
            </Text>
          ) : null}
          {totals.unmatched_lines > 0 ? (
            <Text style={styles.warning}>
              {totals.unmatched_lines} lines are not matched to a product yet, so they appear in the
              total but not in the list below.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <SegmentedToggle
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Group spend by week or by month"
        compact
      />

      {chartData.length > 0 ? (
        <Card>
          <BarChart
            data={chartData}
            barColor={colors.primary}
            valueFormatter={formatCurrency}
            emptyLabel="No spend in this period."
          />
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing bought yet"
          body="Confirmed invoices show up here - scan one and confirm it to see what it cost."
        />
      ) : (
        rows.map((row, index) => (
          <FadeIn key={row.item_id} delay={index * 40}>
            <ItemRow row={row} />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {fontSize: 12, color: colors.textMuted},
  warning: {fontSize: 12, color: colors.warning, marginTop: spacing.xs},
  filters: {gap: spacing.sm},
  summaryCard: {gap: spacing.sm},
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between'},
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taxLabel: {fontSize: 12, color: colors.textMuted, flexShrink: 1},
  taxValue: {fontSize: 14, color: colors.text},
  paidLabel: {fontSize: 13, fontWeight: '700', color: colors.text},
  paidValue: {fontSize: 16, fontWeight: '700', color: colors.primary},
  summaryValue: {fontSize: 22, fontWeight: '700', color: colors.primary},
  itemCard: {gap: spacing.xs},
  itemHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  itemName: {fontSize: 15, fontWeight: '600', color: colors.text, flex: 1},
  itemSpend: {fontSize: 15, fontWeight: '700', color: colors.primary},
});
