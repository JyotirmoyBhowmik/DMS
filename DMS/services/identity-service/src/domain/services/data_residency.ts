export type DataRegion = 'us-east-1' | 'eu-west-1' | 'ap-south-1' | 'ap-southeast-1';

export interface RegionalInfrastructureConfig {
  region: DataRegion;
  postgresHost: string;
  s3BucketEndpoint: string;
  kmsKeyArn: string;
}

export class DataResidencyService {
  private static REGIONAL_CONFIGS: Record<DataRegion, RegionalInfrastructureConfig> = {
    'us-east-1': {
      region: 'us-east-1',
      postgresHost: 'db.us-east-1.dmsenterprise.internal',
      s3BucketEndpoint: 'https://dms-vault-us-east-1.s3.amazonaws.com',
      kmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/us-east-dek',
    },
    'eu-west-1': {
      region: 'eu-west-1',
      postgresHost: 'db.eu-west-1.dmsenterprise.internal',
      s3BucketEndpoint: 'https://dms-vault-eu-west-1.s3.amazonaws.com',
      kmsKeyArn: 'arn:aws:kms:eu-west-1:123456789012:key/eu-west-dek',
    },
    'ap-south-1': {
      region: 'ap-south-1',
      postgresHost: 'db.ap-south-1.dmsenterprise.internal',
      s3BucketEndpoint: 'https://dms-vault-ap-south-1.s3.amazonaws.com',
      kmsKeyArn: 'arn:aws:kms:ap-south-1:123456789012:key/ap-south-dek',
    },
    'ap-southeast-1': {
      region: 'ap-southeast-1',
      postgresHost: 'db.ap-southeast-1.dmsenterprise.internal',
      s3BucketEndpoint: 'https://dms-vault-ap-southeast-1.s3.amazonaws.com',
      kmsKeyArn: 'arn:aws:kms:ap-southeast-1:123456789012:key/ap-se-dek',
    },
  };

  /**
   * Resolves region-pinned infrastructure endpoints for enterprise data residency requirements.
   */
  static getRegionalInfrastructure(region: DataRegion = 'ap-south-1'): RegionalInfrastructureConfig {
    return this.REGIONAL_CONFIGS[region] || this.REGIONAL_CONFIGS['ap-south-1'];
  }
}
