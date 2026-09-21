/**
 * Tidying up who the restaurant buys from and where deliveries go.
 *
 * Both lists fill themselves. Staff add a supplier while reviewing an invoice,
 * and a storage area is created from whatever a delivery note says it was
 * delivered to - which means a misread eventually puts something odd in a
 * filter, and this is where somebody puts it away.
 *
 * Retired rather than deleted, always. A deleted supplier would take its name
 * off every invoice it ever supplied, and those invoices are the record of
 * what was actually bought.
 */
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useAdminSuppliers,
  useAdminWarehouses,
  useCreateSupplier,
  useCreateWarehouse,
  useUpdateSupplier,
  useUpdateWarehouse,
} from '../../../features/inventory/hooks';
import type {Supplier, Warehouse} from '../../../features/inventory/types';
import {colors, spacing} from '../../../theme';

type Row = {id: string; name: string; is_active: boolean};

function SourceRow({
  row,
  onRename,
  onToggle,
  busy,
}: {
  row: Row;
  onRename: (name: string) => Promise<void>;
  onToggle: () => Promise<void>;
  busy: boolean;
}): React.JSX.Element {
  const [name, setName] = useState(row.name);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeApiError(err, fallback));
    }
  }

  const renamed = name.trim() !== row.name && name.trim().length > 0;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.nameField}>
          <TextField label="Name" value={name} onChangeText={setName} />
        </View>
        {!row.is_active ? <Badge label="Retired" tone="neutral" /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {renamed ? (
          <View style={styles.action}>
            <Button
              title="Save name"
              onPress={() => run(() => onRename(name.trim()), 'Could not rename that.')}
              loading={busy}
            />
          </View>
        ) : null}
        <View style={styles.action}>
          <Button
            title={row.is_active ? 'Retire' : 'Bring back'}
            variant="secondary"
            onPress={() => run(onToggle, 'Could not update that.')}
            loading={busy}
          />
        </View>
      </View>
    </Card>
  );
}

function AddRow({
  label,
  onAdd,
  busy,
}: {
  label: string;
  onAdd: (name: string) => Promise<void>;
  busy: boolean;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setError(null);
    try {
      await onAdd(name.trim());
      setName('');
    } catch (err) {
      setError(describeApiError(err, 'Could not add that.'));
    }
  }

  return (
    <Card style={styles.card}>
      <TextField label={label} value={name} onChangeText={setName} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Add" onPress={onPress} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}

export function ManageSourcesScreen(): React.JSX.Element {
  const suppliers = useAdminSuppliers();
  const warehouses = useAdminWarehouses();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();

  if (suppliers.isLoading || warehouses.isLoading) {
    return <LoadingView />;
  }

  const failure = suppliers.error ?? warehouses.error;
  if (failure) {
    return (
      <ErrorState
        message={describeApiError(failure, 'Could not load suppliers and storage areas.')}
        onRetry={() => {
          suppliers.refetch();
          warehouses.refetch();
        }}
      />
    );
  }

  const supplierList: Supplier[] = suppliers.data?.results ?? [];
  const warehouseList: Warehouse[] = warehouses.data?.results ?? [];

  return (
    <Screen
      onRefresh={() => {
        suppliers.refetch();
        warehouses.refetch();
      }}
      refreshing={suppliers.isRefetching || warehouses.isRefetching}>
      <Text style={styles.heading}>Suppliers</Text>
      <Text style={styles.hint}>
        Retiring one keeps it on every invoice it ever supplied - it just stops being offered on new
        ones.
      </Text>

      {supplierList.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          body="They appear here once someone picks one while reviewing an invoice."
        />
      ) : (
        supplierList.map((supplier, index) => (
          <FadeIn key={supplier.id} delay={index * 30}>
            <SourceRow
              row={supplier}
              busy={updateSupplier.isPending}
              onRename={async name => {
                await updateSupplier.mutateAsync({id: supplier.id, input: {name}});
              }}
              onToggle={async () => {
                await updateSupplier.mutateAsync({
                  id: supplier.id,
                  input: {is_active: !supplier.is_active},
                });
              }}
            />
          </FadeIn>
        ))
      )}

      <AddRow
        label="New supplier"
        busy={createSupplier.isPending}
        onAdd={async name => {
          await createSupplier.mutateAsync(name);
        }}
      />

      <Text style={styles.heading}>Storage areas</Text>
      <Text style={styles.hint}>
        These are created automatically from what a delivery note says it was delivered to, so an
        odd one here usually means a misread. Retire it and it stops appearing in filters.
      </Text>

      {warehouseList.length === 0 ? (
        <EmptyState
          title="No storage areas yet"
          body="One appears when a scanned invoice names where it was delivered."
        />
      ) : (
        warehouseList.map((warehouse, index) => (
          <FadeIn key={warehouse.id} delay={index * 30}>
            <SourceRow
              row={warehouse}
              busy={updateWarehouse.isPending}
              onRename={async name => {
                await updateWarehouse.mutateAsync({id: warehouse.id, input: {name}});
              }}
              onToggle={async () => {
                await updateWarehouse.mutateAsync({
                  id: warehouse.id,
                  input: {is_active: !warehouse.is_active},
                });
              }}
            />
          </FadeIn>
        ))
      )}

      <AddRow
        label="New storage area"
        busy={createWarehouse.isPending}
        onAdd={async name => {
          await createWarehouse.mutateAsync(name);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  hint: {fontSize: 12, color: colors.textMuted},
  card: {gap: spacing.sm},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  nameField: {flex: 1},
  actions: {flexDirection: 'row', gap: spacing.sm},
  action: {flexGrow: 1, flexBasis: 120},
  error: {color: colors.danger, fontSize: 12},
});
