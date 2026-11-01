import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

const send = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

describe('MailService', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    send.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should send the reset email through Resend when a key is configured', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const service = new MailService();

    await service.sendResetPassword('john@test.com', 'tok-123');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@test.com',
        html: expect.stringContaining('token=tok-123') as string,
      }),
    );
  });

  it('should use MAIL_FROM as sender when set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.MAIL_FROM = 'TCG <noreply@exemple.fr>';
    send.mockResolvedValue({ data: {}, error: null });

    await new MailService().sendResetPassword('john@test.com', 'tok-123');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'TCG <noreply@exemple.fr>' }),
    );
    delete process.env.MAIL_FROM;
  });

  it('should log a Resend error without leaking the token or throwing', async () => {
    process.env.RESEND_API_KEY = 're_test';
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 403, message: 'domain' },
    });
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      new MailService().sendResetPassword('john@test.com', 'tok-123'),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(expect.stringContaining('403'));
    expect(logError).toHaveBeenCalledWith(
      expect.not.stringContaining('tok-123'),
    );
  });

  it('should start and skip sending when no key is configured', async () => {
    delete process.env.RESEND_API_KEY;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const service = new MailService();
    await expect(
      service.sendResetPassword('john@test.com', 'tok-123'),
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.not.stringContaining('tok-123'));
  });
});
