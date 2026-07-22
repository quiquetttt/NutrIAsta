import { datasetRepository } from '@/storage/dataset-repository.web';
import type { RestoreSession } from '@/storage/dataset-types';

export const rollbackRestoration = (session: RestoreSession) =>
  datasetRepository.rollbackRestoration(session);

export const reactivateRestoration = (session: RestoreSession) =>
  datasetRepository.reactivateRestoration(session);

export const confirmRestoration = (session: RestoreSession) =>
  datasetRepository.confirmRestoration(session);
