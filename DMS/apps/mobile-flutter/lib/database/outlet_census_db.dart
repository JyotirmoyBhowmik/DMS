import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

class LocalOutletCensuses extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get outletId => text()();
  TextColumn get outletName => text()();
  TextColumn get outletType => text()(); // 'kirana' | 'supermarket' | 'wholesale' | 'convenience'
  TextColumn get ownerName => text().nullable()();
  TextColumn get ownerPhone => text()();
  TextColumn get address => text().nullable()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  TextColumn get tradeCategory => text()();
  TextColumn get status => text()(); // 'draft' | 'submitted' | 'verified' | 'approved' | 'rejected'
  TextColumn get kycStatus => text()(); // 'pending' | 'approved' | 'rejected'
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'

  @override
  Set<Column> get primaryKey => {id};
}

/// Helper service for encrypting and decrypting sensitive LocalOutletCensus data at rest.
class EncryptedOutletCensusCache {
  final Uint8List _encryptionKey;

  EncryptedOutletCensusCache(this._encryptionKey);

  /// Encrypts sensitive fields (ownerPhone, ownerName, address) before saving at rest.
  Map<String, dynamic> encryptFields({
    required String ownerPhone,
    String? ownerName,
    String? address,
  }) {
    final encryptedPhone = AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(ownerPhone)),
        _encryptionKey,
      ),
    );

    String? encryptedName;
    if (ownerName != null) {
      encryptedName = AesGcmCipher.pack(
        AesGcmCipher.encrypt(
          Uint8List.fromList(utf8.encode(ownerName)),
          _encryptionKey,
        ),
      );
    }

    String? encryptedAddr;
    if (address != null) {
      encryptedAddr = AesGcmCipher.pack(
        AesGcmCipher.encrypt(
          Uint8List.fromList(utf8.encode(address)),
          _encryptionKey,
        ),
      );
    }

    return {
      'ownerPhone': encryptedPhone,
      'ownerName': encryptedName,
      'address': encryptedAddr,
    };
  }

  /// Decrypts sensitive fields retrieved from local cache database.
  Map<String, String?> decryptFields({
    required String encryptedPhone,
    String? encryptedName,
    String? encryptedAddr,
  }) {
    final decryptedPhone = utf8.decode(
      AesGcmCipher.decrypt(
        AesGcmCipher.unpack(encryptedPhone),
        _encryptionKey,
      ),
    );

    String? decryptedName;
    if (encryptedName != null) {
      decryptedName = utf8.decode(
        AesGcmCipher.decrypt(
          AesGcmCipher.unpack(encryptedName),
          _encryptionKey,
        ),
      );
    }

    String? decryptedAddr;
    if (encryptedAddr != null) {
      decryptedAddr = utf8.decode(
        AesGcmCipher.decrypt(
          AesGcmCipher.unpack(encryptedAddr),
          _encryptionKey,
        ),
      );
    }

    return {
      'ownerPhone': decryptedPhone,
      'ownerName': decryptedName,
      'address': decryptedAddr,
    };
  }
}
