import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

class LocalGeoCheckIns extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get outletId => text()();
  TextColumn get visitId => text().nullable()();
  DateTimeColumn get checkInTime => dateTime()();
  DateTimeColumn get checkOutTime => dateTime().nullable()();
  RealColumn get checkInLat => real()();
  RealColumn get checkInLng => real()();
  RealColumn get checkOutLat => real().nullable()();
  RealColumn get checkOutLng => real().nullable()();
  RealColumn get distanceFromOutlet => real()();
  BoolColumn get isWithinGeofence => boolean().withDefault(const Constant(false))();
  BoolColumn get spoofingDetected => boolean().withDefault(const Constant(false))();
  TextColumn get deviceInfo => text()(); // encrypted JSON string
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update'

  @override
  Set<Column> get primaryKey => {id};
}

/// Helper service for encrypting and decrypting LocalGeoCheckIn data at rest.
class EncryptedGeoCheckInCache {
  final Uint8List _encryptionKey;

  EncryptedGeoCheckInCache(this._encryptionKey);

  /// Encrypts sensitive fields (like agentId and deviceInfo) before storing them at rest.
  Map<String, dynamic> encryptFields(String agentId, Map<String, dynamic> deviceInfo) {
    final encryptedAgentId = AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(agentId)),
        _encryptionKey,
      ),
    );

    final deviceInfoJson = json.encode(deviceInfo);
    final encryptedDeviceInfo = AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(deviceInfoJson)),
        _encryptionKey,
      ),
    );

    return {
      'agentId': encryptedAgentId,
      'deviceInfo': encryptedDeviceInfo,
    };
  }

  /// Decrypts sensitive fields retrieved from local cache database.
  Map<String, dynamic> decryptFields(String encryptedAgentId, String encryptedDeviceInfo) {
    final decryptedAgentId = utf8.decode(
      AesGcmCipher.decrypt(
        AesGcmCipher.unpack(encryptedAgentId),
        _encryptionKey,
      ),
    );

    final decryptedDeviceInfoJson = utf8.decode(
      AesGcmCipher.decrypt(
        AesGcmCipher.unpack(encryptedDeviceInfo),
        _encryptionKey,
      ),
    );
    final decryptedDeviceInfo = json.decode(decryptedDeviceInfoJson) as Map<String, dynamic>;

    return {
      'agentId': decryptedAgentId,
      'deviceInfo': decryptedDeviceInfo,
    };
  }
}
