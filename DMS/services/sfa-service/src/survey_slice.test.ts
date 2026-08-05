import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Survey } from './domain/entities/survey.js';
import { SurveyPgRepository } from './infrastructure/database/repositories/survey.pg-repository.js';
import {
  CreateSurveyUseCase,
  UpdateSurveyUseCase,
  GetSurveyUseCase,
  ListSurveysUseCase,
} from './application/usecases/survey/survey.usecases.js';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const agentId = '00000000-0000-0000-0000-0000000000a1';
const outletId = '00000000-0000-0000-0000-0000000000b1';

const adminPrincipal = {
  id: 'admin-user-uuid',
  tenantId,
  roles: ['admin'],
};

const agentPrincipal = {
  id: 'agent-user-uuid',
  tenantId,
  roles: ['agent'],
};

beforeEach(() => {
  SurveyPgRepository.clearStore();
  AuditController.getInstance().getRepository().clear();
});

describe('SFA Survey Slice Tests', () => {
  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute Survey and validate invariants', () => {
      const survey = Survey.create({
        id: 'survey-1',
        tenantId,
        agentId,
        outletId,
        title: 'Customer Satisfaction',
        description: 'Monthly feedback survey',
      });

      assert.strictEqual(survey.id, 'survey-1');
      assert.strictEqual(survey.tenantId, tenantId);
      assert.strictEqual(survey.agentId, agentId);
      assert.strictEqual(survey.outletId, outletId);
      assert.strictEqual(survey.title, 'Customer Satisfaction');
      assert.strictEqual(survey.description, 'Monthly feedback survey');
      assert.strictEqual(survey.status, 'DRAFT');

      // Invalid ID
      assert.throws(() => {
        Survey.create({
          id: '',
          tenantId,
          agentId,
          outletId,
          title: 'Title',
        });
      }, /ID cannot be empty/);

      // Title exceed 255 char
      assert.throws(() => {
        Survey.create({
          id: 'survey-1',
          tenantId,
          agentId,
          outletId,
          title: 'a'.repeat(256),
        });
      }, /title cannot exceed 255 characters/);
    });

    test('Should enforce state transitions rules', () => {
      const survey = Survey.create({
        id: 'survey-1',
        tenantId,
        agentId,
        outletId,
        title: 'Customer Satisfaction',
      });

      // Update info
      survey.updateInfo({ title: 'New title' });
      assert.strictEqual(survey.title, 'New title');

      // Activate
      survey.activate();
      assert.strictEqual(survey.status, 'ACTIVE');

      // Complete
      survey.complete();
      assert.strictEqual(survey.status, 'COMPLETED');

      // Cannot cancel completed survey
      assert.throws(() => {
        survey.cancel();
      }, /Cannot cancel a completed survey/);

      // Cannot update details of completed survey
      assert.throws(() => {
        survey.updateInfo({ title: 'Forbidden' });
      }, /Cannot update survey details/);
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete surveys in repository', async () => {
      const repo = new SurveyPgRepository();
      const survey = Survey.create({
        id: 'survey-99',
        tenantId,
        agentId,
        outletId,
        title: 'Product Availability',
        description: 'Verify shelf availability',
      });

      await repo.save(survey, tenantId);

      const found = await repo.findById('survey-99', tenantId);
      assert.ok(found);
      assert.strictEqual(found.id, 'survey-99');
      assert.strictEqual(found.title, 'Product Availability');

      const foundByTitle = await repo.findByTitle('Product Availability', tenantId);
      assert.ok(foundByTitle);
      assert.strictEqual(foundByTitle.id, 'survey-99');

      await repo.delete('survey-99', tenantId);
      const deleted = await repo.findById('survey-99', tenantId);
      assert.strictEqual(deleted, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new SurveyPgRepository();
      const createUseCase = new CreateSurveyUseCase(undefined, repo);
      const getUseCase = new GetSurveyUseCase(undefined, repo);
      const updateUseCase = new UpdateSurveyUseCase(undefined, repo);
      const listUseCase = new ListSurveysUseCase(undefined, repo);

      // Create (Agent)
      const survey = await createUseCase.execute(agentPrincipal, {
        id: 'survey-usecase',
        tenantId,
        agentId,
        outletId,
        title: 'Usecase Survey',
        description: 'Usecase test description',
        status: 'DRAFT',
      });

      assert.strictEqual(survey.id, 'survey-usecase');
      assert.strictEqual(survey.title, 'Usecase Survey');

      // Create other tenant denied
      await assert.rejects(async () => {
        await createUseCase.execute(agentPrincipal, {
          id: 'survey-tenant-fail',
          tenantId: otherTenantId,
          agentId,
          outletId,
          title: 'Cross Tenant',
        });
      }, /Forbidden: Tenant boundary violation/);

      // Get (Agent)
      const fetched = await getUseCase.execute(agentPrincipal, 'survey-usecase', tenantId);
      assert.strictEqual(fetched.id, 'survey-usecase');

      // Update details (Agent)
      const updated = await updateUseCase.execute(agentPrincipal, {
        id: 'survey-usecase',
        tenantId,
        title: 'Updated Usecase Survey',
        version: 1,
      });
      assert.strictEqual(updated.title, 'Updated Usecase Survey');

      // Update version conflict check
      await assert.rejects(async () => {
        await updateUseCase.execute(agentPrincipal, {
          id: 'survey-usecase',
          tenantId,
          title: 'Stale Version',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      // List (Agent)
      const list = await listUseCase.execute(agentPrincipal, {
        tenantId,
      });
      assert.strictEqual(list.items.length, 1);
    });

    test('Should audit modifications properly', async () => {
      const repo = new SurveyPgRepository();
      const createUseCase = new CreateSurveyUseCase(undefined, repo);

      await createUseCase.execute(agentPrincipal, {
        id: 'survey-audit',
        tenantId,
        agentId,
        outletId,
        title: 'Audited Survey',
        description: 'Audit log testing',
      });

      const auditRepo = AuditController.getInstance().getRepository();
      const logs = await auditRepo.getAllBlocks();
      assert.ok(logs.length > 0);
      const hasCreated = logs.some((l: any) => l.data && l.data.type === 'survey.create');
      assert.ok(hasCreated);
    });
  });
});
