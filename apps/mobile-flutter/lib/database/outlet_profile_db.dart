import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

class LocalOutletProfiles extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get outletName => text()();
  TextColumn get outletType => text()(); // 'kirana' | 'supermarket' | 'pharmacy' | 'general'
  TextColumn get ownerName => text().nullable()();
  TextColumn get ownerPhone => text()();
  TextColumn get address => text()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  TextColumn get kycStatus => text()(); // 'pending' | 'verified' | 'rejected'
  TextColumn get status => text()(); // 'active' | 'inactive'
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'

  @override
  Set<Column> get primaryKey => {id};
}

class EncryptedOutletProfileCache {
  final Uint8List _encryptionKey;

  EncryptedOutletProfileCache(this._encryptionKey);

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
