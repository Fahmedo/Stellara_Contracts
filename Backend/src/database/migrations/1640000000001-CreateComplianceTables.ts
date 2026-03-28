import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateComplianceTables1640000000001 implements MigrationInterface {
  name = 'CreateComplianceTables1640000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // KYC Verifications table
    await queryRunner.createTable(
      new Table({
        name: 'kyc_verifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'requires_review'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'verification_type',
            type: 'enum',
            enum: ['identity', 'document', 'address', 'enhanced_due_diligence'],
            isNullable: false,
          },
          {
            name: 'provider_verification_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'documents',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'kyc_tier',
            type: 'integer',
            default: 1,
            isNullable: false,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new Index('IDX_KYC_USER_ID', ['user_id']),
          new Index('IDX_KYC_PROVIDER_ID', ['provider_verification_id']),
          new Index('IDX_KYC_STATUS', ['status']),
        ],
      }),
      true,
    );

    // Compliance Reports table
    await queryRunner.createTable(
      new Table({
        name: 'compliance_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'report_type',
            type: 'enum',
            enum: ['kyc_summary', 'suspicious_activity', 'regulatory_filing', 'audit_report'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'submitted', 'reviewed', 'archived'],
            default: "'draft'",
            isNullable: false,
          },
          {
            name: 'content',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'risk_score',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'flags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'period_start',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'period_end',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'submitted_to_authority',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'authority_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new Index('IDX_REPORT_USER_ID', ['user_id']),
          new Index('IDX_REPORT_TYPE', ['report_type']),
          new Index('IDX_REPORT_STATUS', ['status']),
          new Index('IDX_REPORT_PERIOD', ['period_start', 'period_end']),
        ],
      }),
      true,
    );

    // Sanctions Checks table
    await queryRunner.createTable(
      new Table({
        name: 'sanctions_checks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'compliance_report_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'list_source',
            type: 'enum',
            enum: ['ofac', 'un', 'eu', 'hmt', 'custom'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'clear', 'match', 'partial_match', 'error'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'match_score',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'match_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_pep',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'screening_results',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'requires_review',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'review_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewed_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new Index('IDX_SANCTIONS_USER_ID', ['user_id']),
          new Index('IDX_SANCTIONS_REPORT_ID', ['compliance_report_id']),
          new Index('IDX_SANCTIONS_STATUS', ['status']),
          new Index('IDX_SANCTIONS_LIST_SOURCE', ['list_source']),
        ],
      }),
      true,
    );

    // Risk Assessments table
    await queryRunner.createTable(
      new Table({
        name: 'risk_assessments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'kyc_verification_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'risk_score',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'risk_level',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'critical'],
            isNullable: false,
          },
          {
            name: 'risk_factors',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'model_version',
            type: 'varchar',
            length: '20',
            default: "'1.0'",
            isNullable: false,
          },
          {
            name: 'confidence_score',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'recommendations',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'manual_override',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'override_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'override_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new Index('IDX_RISK_USER_ID', ['user_id']),
          new Index('IDX_RISK_KYC_ID', ['kyc_verification_id']),
          new Index('IDX_RISK_LEVEL', ['risk_level']),
          new Index('IDX_RISK_EXPIRES_AT', ['expires_at']),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('risk_assessments');
    await queryRunner.dropTable('sanctions_checks');
    await queryRunner.dropTable('compliance_reports');
    await queryRunner.dropTable('kyc_verifications');
  }
}
