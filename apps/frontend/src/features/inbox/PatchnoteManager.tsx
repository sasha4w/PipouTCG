import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../../services/notification.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import Button from "../../components/Button";
import "../../components/manager.css";

export default function PatchnoteManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const publish = useMutation({
    mutationFn: () =>
      notificationService.createPatchnote({
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    },
  });

  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">{t("admin.patchnote.title")}</h2>
      </div>

      {publish.isError && (
        <p className="manager-error">
          {apiErrorMessage(publish.error) ?? t("admin.patchnote.error")}
        </p>
      )}
      {publish.isSuccess && (
        <p className="manager-result-count" role="status">
          {t("admin.patchnote.published")}
        </p>
      )}

      <form
        className="manager-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canPublish) publish.mutate();
        }}
      >
        <p className="manager-form__title">{t("admin.patchnote.hint")}</p>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="patchnote-title">
            {t("admin.patchnote.title_label")}
          </label>
          <input
            id="patchnote-title"
            className="manager-form__input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="patchnote-body">
            {t("admin.patchnote.body_label")}
          </label>
          <textarea
            id="patchnote-body"
            className="manager-form__textarea"
            rows={8}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="manager-form__actions">
          <Button type="submit" disabled={!canPublish || publish.isPending}>
            {publish.isPending ? "..." : t("admin.patchnote.publish")}
          </Button>
        </div>
      </form>
    </div>
  );
}
