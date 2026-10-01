(() => {
	const {
		token,
		api,
		downloadCSVAuth,
		importCSVAuth,
		formatImportResult,
		esc,
		statusPill,
		table,
		fmtMoney,
		fmtMoneyAmount,
		t,
		isPasswordComplex,
		currencyCode,
		currencyPerLiter,
		noticeTitle,
		statusText,
		categoryText,
		syncRegionalFromServer,
		fmtSG,
		datePart,
		recipeABV,
		appConfirm,
		appInfo,
		pipelineGuide,
		appPrompt,
		fillRecipeSelect,
		recipeOptionLabel,
		refreshOrdersNavCount,
		refreshBrewingNavCounts,
		setNavCount,
		canViewEconomy,
		recipeNextStep,
		navLink,
		canRoles,
		applyRequireRoles,
		showForbidden,
	} = window.BrewhouseCore;

	async function loadSettingsBackup(panel) {
		const listEl = panel.querySelector("#settings-backup");
		const errEl = panel.querySelector("#settings-backup-error");
		const uploadInput = panel.querySelector("#settings-backup-upload");
		const demoEl = panel.querySelector("#settings-demo");
		const demoErrEl = panel.querySelector("#settings-demo-error");

		function formatBytes(n) {
			if (n < 1024) {
				return n + " B";
			}
			if (n < 1024 * 1024) {
				return (n / 1024).toFixed(1) + " KB";
			}
			return (n / (1024 * 1024)).toFixed(1) + " MB";
		}

		function formatWhen(iso) {
			if (!iso) {
				return "";
			}
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) {
				return iso;
			}
			return d.toLocaleString();
		}

		function kindLabel(kind) {
			if (kind === "daily") {
				return t("js.settings.backup_daily");
			}
			if (kind === "monthly") {
				return t("js.settings.backup_monthly");
			}
			if (kind === "manual") {
				return t("js.settings.backup_manual");
			}
			return kind || "";
		}

		function showErr(msg) {
			if (!errEl) {
				return;
			}
			if (!msg) {
				errEl.hidden = true;
				errEl.textContent = "";
				return;
			}
			errEl.hidden = false;
			errEl.textContent = msg;
		}

		function showDemoErr(msg) {
			if (!demoErrEl) {
				return;
			}
			if (!msg) {
				demoErrEl.hidden = true;
				demoErrEl.textContent = "";
				return;
			}
			demoErrEl.hidden = false;
			demoErrEl.textContent = msg;
		}

		async function refreshDemo() {
			if (!demoEl) {
				return;
			}
			showDemoErr("");
			try {
				const info = await api("/api/settings/demo");
				demoEl.hidden = !(info && info.present);
			} catch (e) {
				demoEl.hidden = true;
			}
		}

		async function refresh() {
			showErr("");
			try {
				const list = await api("/api/settings/backup");
				if (!list || !list.length) {
					listEl.innerHTML = '<p class="panel__empty">' + esc(t("js.settings.no_backups")) + "</p>";
					return;
				}
				listEl.innerHTML = table(
					[t("js.settings.backup_taken"), t("js.settings.backup_type"), t("js.settings.backup_size"), t("js.settings.backup_file"), ""],
					list
						.map((b) => {
							const name = esc(b.name || "");
							return (
								"<tr><td>" +
								esc(formatWhen(b.created_at)) +
								"</td><td>" +
								esc(kindLabel(b.kind)) +
								"</td><td>" +
								esc(formatBytes(b.size_bytes || 0)) +
								"</td><td>" +
								name +
								'</td><td class="panel__row-actions">' +
								'<button type="button" class="btn btn--small" data-action="settings-backup-download" data-name="' +
								name +
								'">' +
								esc(t("js.settings.download")) +
								"</button> " +
								'<button type="button" class="btn btn--small" data-action="settings-backup-restore" data-name="' +
								name +
								'">' +
								esc(t("js.settings.restore")) +
								"</button> " +
								'<button type="button" class="btn btn--small" data-action="settings-backup-delete" data-name="' +
								name +
								'">' +
								esc(t("common.delete")) +
								"</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				listEl.textContent = e.message;
			}
		}

		async function downloadBackup(name) {
			await downloadCSVAuth("/api/settings/backup/" + encodeURIComponent(name) + "/download", name);
		}

		async function restoreNamed(name) {
			const ok = await appConfirm({
				title: t("js.settings.restore_backup_title"),
				message: t("js.settings.restore_backup_message", { name: name }),
			});
			if (!ok) {
				return;
			}
			await api("/api/settings/backup/" + encodeURIComponent(name) + "/restore", {
				method: "POST",
			});
			await appInfo({
				title: t("js.settings.restore_complete_title"),
				message: t("js.settings.restore_complete_message"),
			});
			window.location.reload();
		}

		async function restoreUpload(file) {
			const ok = await appConfirm({
				title: t("js.settings.restore_from_file"),
				message:
					t("js.settings.restore_upload_message"),
			});
			if (!ok) {
				return;
			}
			const fd = new FormData();
			fd.append("file", file);
			const res = await fetch("/api/settings/backup/restore-upload", {
				method: "POST",
				headers: { Authorization: "Bearer " + token() },
				body: fd,
			});
			const text = await res.text();
			let data = null;
			try {
				data = text ? JSON.parse(text) : null;
			} catch {
				data = { error: text };
			}
			if (!res.ok) {
				throw new Error((data && data.error) || res.statusText);
			}
			await appInfo({
				title: t("js.settings.restore_complete_title"),
				message: t("js.settings.restore_complete_message"),
			});
			window.location.reload();
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const action = el.getAttribute("data-action");
			if (action === "settings-backup-refresh") {
				refresh();
				refreshDemo();
				return;
			}
			if (action === "settings-backup-now") {
				showErr("");
				try {
					await api("/api/settings/backup", { method: "POST" });
					refresh();
				} catch (e) {
					showErr(e.message);
				}
				return;
			}
			if (action === "settings-purge-demo") {
				const ok = await appConfirm({
					title: t("js.settings.purge_demo_title"),
					message: t("js.settings.purge_demo_message"),
				});
				if (!ok) {
					return;
				}
				showDemoErr("");
				try {
					await api("/api/settings/demo/purge", { method: "POST" });
					await appInfo({
						title: t("js.settings.purge_demo_done_title"),
						message: t("js.settings.purge_demo_done_message"),
					});
					await refreshDemo();
					if (typeof refreshBrewingNavCounts === "function") {
						refreshBrewingNavCounts();
					}
				} catch (e) {
					showDemoErr(e.message);
				}
				return;
			}
			const name = el.getAttribute("data-name");
			if (action === "settings-backup-download" && name) {
				try {
					await downloadBackup(name);
				} catch (e) {
					showErr(e.message);
				}
				return;
			}
			if (action === "settings-backup-restore" && name) {
				try {
					await restoreNamed(name);
				} catch (e) {
					showErr(e.message);
				}
				return;
			}
			if (action === "settings-backup-delete" && name) {
				const ok = await appConfirm({
					title: t("js.settings.delete_backup_title"),
					message: t("js.settings.delete_backup_message", { name: name }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/settings/backup/" + encodeURIComponent(name), {
						method: "DELETE",
					});
					refresh();
				} catch (e) {
					showErr(e.message);
				}
			}
		});

		if (uploadInput) {
			uploadInput.addEventListener("change", async () => {
				const file = uploadInput.files && uploadInput.files[0];
				uploadInput.value = "";
				if (!file) {
					return;
				}
				showErr("");
				try {
					await restoreUpload(file);
				} catch (e) {
					showErr(e.message);
				}
			});
		}

		refresh();
		refreshDemo();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["settings-backup"] = loadSettingsBackup;
})();
