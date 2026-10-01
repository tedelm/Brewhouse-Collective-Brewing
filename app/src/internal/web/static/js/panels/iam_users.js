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

	async function loadIAMUsers(panel) {
		const usersEl = panel.querySelector("#iam-users");

		async function refreshUsers() {
			try {
				const users = await api("/api/users");
				usersEl.innerHTML = table(
					[t("common.id"), t("common.username"), t("common.name"), t("common.email"), t("common.role"), t("common.active"), ""],
					(users || [])
						.map((u) => {
							const active = u.active !== false;
							const label = active ? t("js.iam.active") : t("js.iam.inactive");
							const btnLabel = active ? t("js.iam.deactivate") : t("js.iam.activate");
							const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
							const btn =
								'<button type="button" class="btn btn--small" data-edit-user="' +
								u.id +
								'">' + esc(t("common.edit")) + "</button> " +
								'<button type="button" class="btn btn--small" data-set-active="' +
								u.id +
								'" data-active="' +
								(active ? "0" : "1") +
								'">' +
								btnLabel +
								'</button> <button type="button" class="btn btn--small" data-reset-password="' +
								u.id +
								'">' + esc(t("iam.users.reset_password")) + "</button>";
							return (
								"<tr><td>" +
								u.id +
								"</td><td>" +
								esc(u.username) +
								"</td><td>" +
								esc(name || "—") +
								"</td><td>" +
								esc(u.email || "") +
								"</td><td>" +
								esc(u.role || "—") +
								"</td><td>" +
								label +
								"</td><td>" +
								btn +
								"</td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				usersEl.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const action = el.getAttribute("data-action");
			if (action === "iam-users-refresh") {
				refreshUsers();
			}
			if (action === "iam-users-export") {
				try {
					await downloadCSVAuth("/api/users/export", "users.csv");
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (action === "iam-users-import") {
				const input = panel.querySelector("#iam-users-import-file");
				if (input) {
					input.value = "";
					input.click();
				}
			}
			if (action === "iam-user-new") {
				const dlg = panel.querySelector("#iam-user-dialog");
				const brewSel = dlg.querySelector('[name="brewery_id"]');
				try {
					const breweries = await api("/api/breweries");
					brewSel.innerHTML =
						'<option value="">' + esc(t("common.none")) + "</option>" +
						(breweries || [])
							.map((b) => '<option value="' + b.id + '">' + esc(b.name) + "</option>")
							.join("");
				} catch (e) {
					brewSel.innerHTML = '<option value="">' + esc(t("common.none")) + "</option>";
				}
				dlg.showModal();
			}
			if (el.hasAttribute("data-edit-user")) {
				const id = el.getAttribute("data-edit-user");
				const dlg = panel.querySelector("#iam-edit-user-dialog");
				const form = panel.querySelector("#iam-edit-user-form");
				const roleSel = form.querySelector('[name="role"]');
				const hint = panel.querySelector("#iam-edit-role-hint");
				const selfID = sessionStorage.getItem("brewhouse_user_id") || "";
				try {
					const user = await api("/api/users/" + id);
					form.querySelector('[name="user_id"]').value = user.id;
					form.querySelector('[name="username"]').value = user.username || "";
					form.querySelector('[name="email"]').value = user.email || "";
					form.querySelector('[name="first_name"]').value = user.first_name || "";
					form.querySelector('[name="last_name"]').value = user.last_name || "";
					form.querySelector('[name="address_line1"]').value = user.address_line1 || "";
					form.querySelector('[name="address_line2"]').value = user.address_line2 || "";
					form.querySelector('[name="phone"]').value = user.phone || "";
					form.querySelector('[name="instagram"]').value = user.instagram || "";
					roleSel.value = user.role || "user";
					const editingSelfAdmin =
						String(user.id) === selfID && (user.role || "") === "admin";
					form.querySelector('[name="username"]').readOnly = false;
					roleSel.disabled = editingSelfAdmin;
					hint.hidden = !editingSelfAdmin;
					dlg.showModal();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-set-active")) {
				const id = el.getAttribute("data-set-active");
				const active = el.getAttribute("data-active") === "1";
				try {
					await api("/api/users/" + id + "/active", {
						method: "PATCH",
						body: JSON.stringify({ active }),
					});
					refreshUsers();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-reset-password")) {
				const id = el.getAttribute("data-reset-password");
				const dlg = panel.querySelector("#iam-reset-password-dialog");
				const form = panel.querySelector("#iam-reset-password-form");
				try {
					const user = await api("/api/users/" + id);
					form.querySelector('[name="user_id"]').value = user.id;
					form.querySelector('[name="username"]').value = user.username || "";
					form.querySelector('[name="email"]').value = user.email || "";
					form.querySelector('[name="role"]').value = user.role || "user";
					form.querySelector('[name="first_name"]').value = user.first_name || "";
					form.querySelector('[name="last_name"]').value = user.last_name || "";
					form.querySelector('[name="address_line1"]').value = user.address_line1 || "";
					form.querySelector('[name="address_line2"]').value = user.address_line2 || "";
					form.querySelector('[name="phone"]').value = user.phone || "";
					form.querySelector('[name="instagram"]').value = user.instagram || "";
					form.querySelector('[name="password"]').value = "";
					dlg.showModal();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
		});

		const userDialog = panel.querySelector("#iam-user-dialog");
		const userForm = panel.querySelector("#iam-user-form");
		userDialog.addEventListener("close", async () => {
			if (userDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(userForm);
			const password = String(fd.get("password") || "");
			if (!isPasswordComplex(password)) {
				await appInfo({ title: noticeTitle(), message: t("common.password_invalid") });
				return;
			}
			const body = {
				username: fd.get("username"),
				password: password,
				email: fd.get("email"),
				first_name: fd.get("first_name"),
				last_name: fd.get("last_name"),
				address_line1: fd.get("address_line1"),
				address_line2: fd.get("address_line2"),
				phone: fd.get("phone"),
				instagram: fd.get("instagram"),
				role: fd.get("role"),
			};
			const breweryID = fd.get("brewery_id");
			if (breweryID) {
				body.brewery_id = parseInt(breweryID, 10);
			}
			try {
				await api("/api/users", {
					method: "POST",
					body: JSON.stringify(body),
				});
				userForm.reset();
				refreshUsers();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		const editUserDialog = panel.querySelector("#iam-edit-user-dialog");
		const editUserForm = panel.querySelector("#iam-edit-user-form");
		editUserDialog.addEventListener("close", async () => {
			if (editUserDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(editUserForm);
			const id = fd.get("user_id");
			const roleSel = editUserForm.querySelector('[name="role"]');
			const role = roleSel.disabled ? "admin" : fd.get("role");
			const selfID = sessionStorage.getItem("brewhouse_user_id") || "";
			if (String(id) === selfID && role !== "admin") {
				await appInfo({ title: noticeTitle(), message: t("js.iam.cannot_demote_self") });
				return;
			}
			try {
				await api("/api/users/" + id, {
					method: "PATCH",
					body: JSON.stringify({
						username: fd.get("username"),
						email: fd.get("email"),
						first_name: fd.get("first_name"),
						last_name: fd.get("last_name"),
						address_line1: fd.get("address_line1"),
						address_line2: fd.get("address_line2"),
						phone: fd.get("phone"),
						instagram: fd.get("instagram"),
						role: role,
					}),
				});
				editUserForm.reset();
				roleSel.disabled = false;
				panel.querySelector("#iam-edit-role-hint").hidden = true;
				refreshUsers();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		const resetDialog = panel.querySelector("#iam-reset-password-dialog");
		const resetForm = panel.querySelector("#iam-reset-password-form");
		resetDialog.addEventListener("close", async () => {
			if (resetDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(resetForm);
			const id = fd.get("user_id");
			const password = String(fd.get("password") || "");
			if (!isPasswordComplex(password)) {
				await appInfo({ title: noticeTitle(), message: t("common.password_invalid") });
				return;
			}
			try {
				await api("/api/users/" + id, {
					method: "PATCH",
					body: JSON.stringify({
						username: fd.get("username"),
						email: fd.get("email"),
						first_name: fd.get("first_name"),
						last_name: fd.get("last_name"),
						address_line1: fd.get("address_line1"),
						address_line2: fd.get("address_line2"),
						phone: fd.get("phone"),
						instagram: fd.get("instagram"),
						role: fd.get("role"),
						password: password,
					}),
				});
				resetForm.reset();
				await appInfo({ title: noticeTitle(), message: t("js.iam.password_updated") });
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		const usersImportFile = panel.querySelector("#iam-users-import-file");
		if (usersImportFile) {
			usersImportFile.addEventListener("change", async () => {
				const file = usersImportFile.files && usersImportFile.files[0];
				if (!file) {
					return;
				}
				try {
					const result = await importCSVAuth("/api/users/import", file);
					await appInfo({
						title: t("js.inventory.import_result"),
						message: formatImportResult(result || {}),
					});
					refreshUsers();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				} finally {
					usersImportFile.value = "";
				}
			});
		}

		refreshUsers();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["iam-users"] = loadIAMUsers;
})();
