import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateFeatureFlagsTables1640000000002 implements MigrationInterface {
  name = 'CreateFeatureFlagsTables1640000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create feature_flags table
    await queryRunner.createTable(
      new Table({
        name: 'feature_flags',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'rollout_strategy',
            type: 'enum',
            enum: ['boolean', 'percentage', 'user_segment', 'whitelist', 'gradual'],
            default: "'boolean'",
          },
          {
            name: 'rollout_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'target_segments',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'whitelisted_users',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'blacklisted_users',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'gradual_config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'owner',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_kill_switch',
            type: 'boolean',
            default: false,
          },
          {
            name: 'environment',
            type: 'varchar',
            length: '50',
            default: "'development'",
          },
          {
            name: 'evaluation_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_evaluated_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create feature_flag_evaluations table
    await queryRunner.createTable(
      new Table({
        name: 'feature_flag_evaluations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'feature_flag_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'result',
            type: 'boolean',
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'variant',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create experiments table
    await queryRunner.createTable(
      new Table({
        name: 'experiments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'running', 'paused', 'completed', 'archived'],
            default: "'draft'",
          },
          {
            name: 'traffic_allocation',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 100,
          },
          {
            name: 'target_segments',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'hypothesis',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'success_criteria',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'owner',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'environment',
            type: 'varchar',
            length: '50',
            default: "'development'",
          },
          {
            name: 'participant_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'conversion_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create experiment_variants table
    await queryRunner.createTable(
      new Table({
        name: 'experiment_variants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'experiment_id',
            type: 'uuid',
          },
          {
            name: 'variant_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'traffic_allocation',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'is_control',
            type: 'boolean',
            default: false,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'participant_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'conversion_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'conversion_rate',
            type: 'decimal',
            precision: 5,
            scale: 4,
            default: 0,
          },
          {
            name: 'statistical_significance',
            type: 'decimal',
            precision: 5,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'confidence_interval',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'feature_flags',
      new Index('IDX_feature_flags_key', ['key']),
    );

    await queryRunner.createIndex(
      'feature_flags',
      new Index('IDX_feature_flags_environment', ['environment']),
    );

    await queryRunner.createIndex(
      'feature_flags',
      new Index('IDX_feature_flags_is_enabled', ['is_enabled']),
    );

    await queryRunner.createIndex(
      'feature_flag_evaluations',
      new Index('IDX_feature_flag_evaluations_feature_flag_id', ['feature_flag_id']),
    );

    await queryRunner.createIndex(
      'feature_flag_evaluations',
      new Index('IDX_feature_flag_evaluations_user_id', ['user_id']),
    );

    await queryRunner.createIndex(
      'feature_flag_evaluations',
      new Index('IDX_feature_flag_evaluations_created_at', ['created_at']),
    );

    await queryRunner.createIndex(
      'experiments',
      new Index('IDX_experiments_key', ['key']),
    );

    await queryRunner.createIndex(
      'experiments',
      new Index('IDX_experiments_status', ['status']),
    );

    await queryRunner.createIndex(
      'experiments',
      new Index('IDX_experiments_environment', ['environment']),
    );

    await queryRunner.createIndex(
      'experiment_variants',
      new Index('IDX_experiment_variants_experiment_id', ['experiment_id']),
    );

    await queryRunner.createIndex(
      'experiment_variants',
      new Index('IDX_experiment_variants_variant_key', ['variant_key']),
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE feature_flag_evaluations 
      ADD CONSTRAINT FK_feature_flag_evaluations_feature_flag 
      FOREIGN KEY (feature_flag_id) 
      REFERENCES feature_flags(id) 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE experiment_variants 
      ADD CONSTRAINT FK_experiment_variants_experiment 
      FOREIGN KEY (experiment_id) 
      REFERENCES experiments(id) 
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(`
      ALTER TABLE feature_flag_evaluations 
      DROP CONSTRAINT IF EXISTS FK_feature_flag_evaluations_feature_flag
    `);

    await queryRunner.query(`
      ALTER TABLE experiment_variants 
      DROP CONSTRAINT IF EXISTS FK_experiment_variants_experiment
    `);

    // Drop tables
    await queryRunner.dropTable('experiment_variants');
    await queryRunner.dropTable('experiments');
    await queryRunner.dropTable('feature_flag_evaluations');
    await queryRunner.dropTable('feature_flags');
  }
}
