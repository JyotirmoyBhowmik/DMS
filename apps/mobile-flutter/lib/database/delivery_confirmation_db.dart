import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

class LocalDeliveryConfirmations extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get orderId => text()();
  TextColumn get deliveredAt => text()(); // ISO Date string
  TextColumn get receivedBy => text()(); // Encrypted sensitive column (PII name)
  TextColumn get signaturePhotoUrl => text().nullable()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  TextColumn get status => text()(); // 'FULL' | 'PARTIAL' | 'REJECTED'
  TextColumn get rejectionReason => text().nullable()();
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'

  @override
  Set<Column> get primaryKey => {id};
}

class EncryptedDeliveryConfirmationCache {
  final Uint8List _encryptionKey;

  EncryptedDeliveryConfirmationCache(this._encryptionKey);

  Map<String, dynamic> encryptFields({
    required String receivedBy,
  }) {
    final encryptedReceivedBy = AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(receivedBy)),
        _encryptionKey,
      ),
    );

    return {
      'receivedBy': encryptedReceivedBy,
    };
  }

  Map<String, String> decryptFields({
    required String encryptedReceivedBy,
  }) {
    final decryptedReceivedBy = utf8.decode(
      AesGcmCipher.decrypt(
        AesGcmCipher.unpack(encryptedReceivedBy),
        _encryptionKey,
      ),
    );

    return {
      'receivedBy': decryptedReceivedBy,
    };
  }
}
