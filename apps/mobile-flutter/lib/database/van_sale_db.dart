import 'package:drift/drift.dart';

class LocalVanSales extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get vehicleId => text()();
  TextColumn get routeId => text()();
  TextColumn get date => text()(); // YYYY-MM-DD
  TextColumn get loadedItems => text()(); // JSON string
  TextColumn get soldItems => text()(); // JSON string
  TextColumn get returnedItems => text()(); // JSON string
  IntColumn get cashCollectedCents => integer().withDefault(const Constant(0))();
  TextColumn get cashCurrency => text().withDefault(const Constant('INR'))();
  IntColumn get digitalPaymentsCents => integer().withDefault(const Constant(0))();
  TextColumn get digitalCurrency => text().withDefault(const Constant('INR'))();
  TextColumn get status => text()(); // 'loading' | 'in_transit' | 'selling' | 'reconciliation' | 'closed'
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'

  @override
  Set<Column> get primaryKey => {id};
}
