import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import {
  NotificationsController,
  PatchnotesController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { NotificationCategory } from '@pipou/shared';
import type { AuthenticatedRequest } from '../auth/auth-user';

const service = {
  list: jest.fn(),
  markAllRead: jest.fn(),
  createPatchnote: jest.fn(),
};
const req = (userId: number): AuthenticatedRequest => ({
  user: { userId, isAdmin: false },
});

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let patchnotes: PatchnotesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: jest.fn().mockReturnValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController, PatchnotesController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allow)
      .overrideGuard(AdminGuard)
      .useValue(allow)
      .compile();
    controller = module.get(NotificationsController);
    patchnotes = module.get(PatchnotesController);
  });

  it('list délègue au service avec le joueur connecté', async () => {
    service.list.mockResolvedValue({
      items: [],
      unread: { all: 0, reward: 0, information: 0 },
    });
    await controller.list(req(7), {
      category: NotificationCategory.REWARD,
      limit: 10,
    });
    expect(service.list).toHaveBeenCalledWith(
      7,
      NotificationCategory.REWARD,
      10,
    );
  });

  it('readAll délègue au service', async () => {
    await controller.readAll(req(7));
    expect(service.markAllRead).toHaveBeenCalledWith(7);
  });

  it('le flux SSE ne transmet que les messages du joueur et les diffusions', async () => {
    const received = firstValueFrom(controller.events(req(7)));
    controller.onCreated({ userId: 9 }); // autre joueur : ignoré
    controller.onCreated({ userId: 7 });
    await expect(received).resolves.toEqual({
      type: 'notification.created',
      data: '{}',
    });
  });

  it('une diffusion (userId null) atteint tout le monde', async () => {
    const received = firstValueFrom(controller.events(req(7)));
    controller.onCreated({ userId: null });
    await expect(received).resolves.toMatchObject({
      type: 'notification.created',
    });
  });

  it('crée un patchnote', async () => {
    service.createPatchnote.mockResolvedValue({ id: 1 });
    await patchnotes.create({ title: 'v1', body: 'x' });
    expect(service.createPatchnote).toHaveBeenCalledWith({
      title: 'v1',
      body: 'x',
    });
  });
});
