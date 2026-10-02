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

	async function loadIAMBreweries(panel) {
		const brewEl = panel.querySelector("#iam-breweries");
		const isAdmin = canRoles("admin");
		applyRequireRoles(panel);

		function breweryLogoURL(id) {
			return "/brewery/" + id + "/logo?t=" + Date.now();
		}

		function setBreweryLogoPreview(breweryID, configured) {
			const preview = panel.querySelector("#iam-brewery-logo-preview");
			if (!preview) {
				return;
			}
			if (configured && breweryID) {
				preview.hidden = false;
				preview.src = breweryLogoURL(breweryID);
			} else {
				preview.hidden = true;
				preview.removeAttribute("src");
			}
		}

		async function refreshBreweries() {
			try {
				const list = await api("/api/breweries");
				brewEl.innerHTML = (list || [])
					.map((b) => {
						const logo = b.logo_configured
							? '<img class="iam-brewery-card__logo" src="' +
								breweryLogoURL(b.id) +
								'" alt="" width="48" height="48">'
							: "";
						const editBtn = b.can_manage
							? '<button type="button" class="btn btn--small" data-edit-brewery="' +
								b.id +
								'">' + esc(t("common.edit")) + "</button> "
							: "";
						const delBtn = isAdmin
							? '<button type="button" class="btn btn--small" data-del-brewery="' +
								b.id +
								'" data-brewery-name="' +
								esc(b.name) +
								'">' + esc(t("common.remove")) + "</button> "
							: "";
						const addBtn = b.can_manage
							? '<button type="button" class="btn btn--small" data-add-member="' +
								b.id +
								'" data-brewery-name="' +
								esc(b.name) +
								'">' + esc(t("iam.breweries.add_member")) + "</button> "
							: "";
						const membersBtn =
							'<button type="button" class="btn btn--small" data-list-members="' +
							b.id +
							'" data-brewery-name="' +
							esc(b.name) +
							'">' + esc(t("iam.breweries.members")) + "</button>";
						const ig = b.instagram
							? ' <a href="' +
								esc(b.instagram) +
								'" target="_blank" rel="noopener noreferrer">' +
								esc(b.instagram) +
								"</a>"
							: "";
						const ut = b.untappd
							? ' <a href="' +
								esc(b.untappd) +
								'" target="_blank" rel="noopener noreferrer">' +
								esc(b.untappd) +
								"</a>"
							: "";
						return (
							'<div class="panel__card"><div class="panel__card-head">' +
							logo +
							"<strong>#" +
							b.id +
							" " +
							esc(b.name) +
							"</strong></div>" +
							esc(b.contact_name) +
							" " +
							esc(b.contact_email) +
							" " +
							esc(b.contact_phone || "") +
							ig +
							ut +
							'<div class="panel__card-actions">' +
							editBtn +
							delBtn +
							addBtn +
							membersBtn +
							"</div></div>"
						);
					})
					.join("") || '<p class="panel__empty">' + esc(t("js.iam.no_breweries")) + "</p>";
			} catch (e) {
				brewEl.textContent = e.message;
			}
		}

		async function fillBreweryAdminSelect(selectEl, selectedID) {
			try {
				const users = await api("/api/users");
				selectEl.innerHTML =
					'<option value="">' + esc(t("common.none")) + "</option>" +
					(users || [])
						.filter((u) => u.active !== false)
						.map(
							(u) =>
								'<option value="' +
								u.id +
								'">' +
								esc(u.username + (u.email ? " (" + u.email + ")" : "")) +
								"</option>"
						)
						.join("");
				if (selectedID) {
					selectEl.value = String(selectedID);
				}
			} catch (e) {
				selectEl.innerHTML = '<option value="">' + esc(t("common.none")) + "</option>";
			}
		}

		async function openBreweryDialog(breweryID) {
			const dlg = panel.querySelector("#iam-brewery-dialog");
			const form = panel.querySelector("#iam-brewery-form");
			const title = panel.querySelector("#iam-brewery-title");
			const adminSel = form.querySelector('[name="brewery_admin_user_id"]');
			const logoBlock = panel.querySelector("#iam-brewery-logo-block");
			const logoErr = panel.querySelector("#iam-brewery-logo-error");
			const logoFile = panel.querySelector("#iam-brewery-logo-file");
			form.reset();
			form.querySelector('[name="brewery_id"]').value = breweryID ? String(breweryID) : "";
			if (logoErr) {
				logoErr.hidden = true;
				logoErr.textContent = "";
			}
			if (logoFile) {
				logoFile.value = "";
			}
			let adminID = "";
			let logoConfigured = false;
			if (breweryID) {
				title.textContent = t("js.iam.edit_brewery");
				const [brewery, members] = await Promise.all([
					api("/api/breweries/" + breweryID),
					api("/api/breweries/" + breweryID + "/members"),
				]);
				form.querySelector('[name="name"]').value = brewery.name || "";
				form.querySelector('[name="contact_name"]').value = brewery.contact_name || "";
				form.querySelector('[name="contact_email"]').value = brewery.contact_email || "";
				form.querySelector('[name="contact_phone"]').value = brewery.contact_phone || "";
				form.querySelector('[name="instagram"]').value = brewery.instagram || "";
				form.querySelector('[name="untappd"]').value = brewery.untappd || "";
				logoConfigured = !!brewery.logo_configured;
				const admin = (members || []).find((m) => m.role === "brewery_admin");
				if (admin) {
					adminID = String(admin.user_id);
				}
				if (logoBlock) {
					logoBlock.hidden = false;
				}
				setBreweryLogoPreview(breweryID, logoConfigured);
			} else {
				title.textContent = t("js.iam.new_brewery");
				if (logoBlock) {
					logoBlock.hidden = true;
				}
				setBreweryLogoPreview(null, false);
			}
			if (isAdmin) {
				await fillBreweryAdminSelect(adminSel, adminID);
			}
			applyRequireRoles(form);
			dlg.showModal();
		}

		const membersDialog = panel.querySelector("#iam-members-dialog");
		const membersClose = panel.querySelector("#iam-members-close");

		async function refreshMembersList(breweryID) {
			const listEl = panel.querySelector("#iam-members-list");
			listEl.textContent = t("js.loading");
			try {
				const members = await api("/api/breweries/" + breweryID + "/members");
				if (!members || !members.length) {
					listEl.innerHTML = '<p class="panel__empty">' + esc(t("js.iam.no_members")) + "</p>";
					return;
				}
				const roles = ["user", "superuser", "brewery_admin"];
				listEl.innerHTML = table(
					[t("common.user"), t("common.role"), ""],
					members
						.map((m) => {
							const opts = roles
								.map(
									(r) =>
										'<option value="' +
										r +
										'"' +
										(m.role === r ? " selected" : "") +
										">" +
										r +
										"</option>"
								)
								.join("");
							return (
								"<tr><td>" +
								esc(m.username) +
								'</td><td><select data-member-role="' +
								m.user_id +
								'" data-prev-role="' +
								esc(m.role) +
								'">' +
								opts +
								'</select></td><td><button type="button" class="btn btn--small" data-remove-member="' +
								m.user_id +
								'">' + esc(t("common.remove")) + "</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				listEl.textContent = e.message;
			}
		}

		async function openMembersDialog(breweryID, breweryName) {
			panel.querySelector("#iam-members-brewery-id").value = breweryID;
			panel.querySelector("#iam-members-title").textContent = t("js.iam.members_title", { name: breweryName });
			await refreshMembersList(breweryID);
			membersDialog.showModal();
		}

		if (membersClose) {
			membersClose.addEventListener("click", () => {
				membersDialog.close();
			});
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const action = el.getAttribute("data-action");
			if (action === "iam-breweries-refresh") {
				refreshBreweries();
			}
			if (action === "iam-brewery-logo-upload") {
				const breweryID = panel.querySelector('#iam-brewery-form [name="brewery_id"]').value;
				const fileInput = panel.querySelector("#iam-brewery-logo-file");
				const errEl = panel.querySelector("#iam-brewery-logo-error");
				errEl.hidden = true;
				const file = fileInput && fileInput.files && fileInput.files[0];
				if (!breweryID) {
					errEl.hidden = false;
					errEl.textContent = t("js.iam.save_before_logo");
					return;
				}
				if (!file) {
					errEl.hidden = false;
					errEl.textContent = t("js.iam.choose_file");
					return;
				}
				try {
					const fd = new FormData();
					fd.append("logo", file);
					const res = await fetch("/api/breweries/" + breweryID + "/logo", {
						method: "PUT",
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
					fileInput.value = "";
					setBreweryLogoPreview(breweryID, true);
					refreshBreweries();
				} catch (e) {
					errEl.hidden = false;
					errEl.textContent = e.message;
				}
				return;
			}
			if (action === "iam-brewery-logo-reset") {
				const breweryID = panel.querySelector('#iam-brewery-form [name="brewery_id"]').value;
				const errEl = panel.querySelector("#iam-brewery-logo-error");
				errEl.hidden = true;
				if (!breweryID) {
					return;
				}
				try {
					await api("/api/breweries/" + breweryID + "/logo", { method: "DELETE" });
					setBreweryLogoPreview(breweryID, false);
					refreshBreweries();
				} catch (e) {
					errEl.hidden = false;
					errEl.textContent = e.message;
				}
				return;
			}
			if (action === "iam-breweries-export") {
				try {
					await downloadCSVAuth("/api/breweries/export", "breweries.csv");
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (action === "iam-breweries-import") {
				const input = panel.querySelector("#iam-breweries-import-file");
				if (input) {
					input.value = "";
					input.click();
				}
			}
			if (action === "iam-members-export") {
				try {
					await downloadCSVAuth("/api/breweries/members/export", "members.csv");
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (action === "iam-members-import") {
				const input = panel.querySelector("#iam-members-import-file");
				if (input) {
					input.value = "";
					input.click();
				}
			}
			if (action === "iam-brewery-new") {
				try {
					await openBreweryDialog(null);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-edit-brewery")) {
				try {
					await openBreweryDialog(el.getAttribute("data-edit-brewery"));
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-del-brewery")) {
				const id = el.getAttribute("data-del-brewery");
				const name = el.getAttribute("data-brewery-name") || id;
				const ok = await appConfirm({
					title: t("js.iam.remove_brewery_title"),
					message: t("js.iam.remove_brewery_message", { id: id, name: name }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/breweries/" + id, { method: "DELETE" });
					refreshBreweries();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-add-member")) {
				const breweryID = el.getAttribute("data-add-member");
				const dlg = panel.querySelector("#iam-member-dialog");
				const form = panel.querySelector("#iam-member-form");
				const userSel = form.querySelector('[name="user_id"]');
				form.querySelector('[name="brewery_id"]').value = breweryID;
				userSel.innerHTML = '<option value="">' + esc(t("iam.breweries.select_user")) + "</option>";
				try {
					const [users, members] = await Promise.all([
						api("/api/users"),
						api("/api/breweries/" + breweryID + "/members"),
					]);
					const memberIDs = new Set((members || []).map((m) => m.user_id));
					userSel.innerHTML =
						'<option value="">' + esc(t("iam.breweries.select_user")) + "</option>" +
						(users || [])
							.filter((u) => u.active !== false && !memberIDs.has(u.id))
							.map(
								(u) =>
									'<option value="' +
									u.id +
									'">' +
									esc(u.username + (u.email ? " (" + u.email + ")" : "")) +
									"</option>"
							)
							.join("");
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
					return;
				}
				dlg.showModal();
			}
			if (el.hasAttribute("data-list-members")) {
				const breweryID = el.getAttribute("data-list-members");
				const name = el.getAttribute("data-brewery-name") || "#" + breweryID;
				openMembersDialog(breweryID, name);
			}
			if (el.hasAttribute("data-remove-member")) {
				const breweryID = panel.querySelector("#iam-members-brewery-id").value;
				const userID = el.getAttribute("data-remove-member");
				const ok = await appConfirm({
					title: t("js.iam.remove_member_title"),
					message: t("js.iam.remove_member_message"),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/breweries/" + breweryID + "/members/" + userID, {
						method: "DELETE",
					});
					await refreshMembersList(breweryID);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
		});

		panel.addEventListener("change", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (!el.hasAttribute("data-member-role")) {
				return;
			}
			const breweryID = panel.querySelector("#iam-members-brewery-id").value;
			const userID = parseInt(el.getAttribute("data-member-role"), 10);
			const prevRole = el.getAttribute("data-prev-role") || "";
			const newRole = el.value;
			if (newRole === prevRole) {
				return;
			}
			const ok = await appConfirm({
				title: t("js.iam.change_role_title"),
				message: t("js.iam.change_role_message", { role: newRole }),
			});
			if (!ok) {
				el.value = prevRole;
				return;
			}
			try {
				await api("/api/breweries/" + breweryID + "/members", {
					method: "POST",
					body: JSON.stringify({ user_id: userID, role: newRole }),
				});
				el.setAttribute("data-prev-role", newRole);
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
				await refreshMembersList(breweryID);
			}
		});

		const breweryDialog = panel.querySelector("#iam-brewery-dialog");
		const breweryForm = panel.querySelector("#iam-brewery-form");
		breweryDialog.addEventListener("close", async () => {
			if (breweryDialog.returnValue !== "save") {
				breweryForm.reset();
				return;
			}
			const fd = new FormData(breweryForm);
			const breweryID = fd.get("brewery_id");
			const adminID = fd.get("brewery_admin_user_id");
			const body = {
				name: fd.get("name"),
				contact_name: fd.get("contact_name"),
				contact_email: fd.get("contact_email"),
				contact_phone: fd.get("contact_phone"),
				instagram: fd.get("instagram"),
				untappd: fd.get("untappd"),
			};
			if (isAdmin && adminID) {
				body.brewery_admin_user_id = parseInt(adminID, 10);
			}
			try {
				if (breweryID) {
					await api("/api/breweries/" + breweryID, {
						method: "PUT",
						body: JSON.stringify(body),
					});
				} else {
					await api("/api/breweries", { method: "POST", body: JSON.stringify(body) });
				}
				breweryForm.reset();
				refreshBreweries();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		const memberDialog = panel.querySelector("#iam-member-dialog");
		const memberForm = panel.querySelector("#iam-member-form");
		memberDialog.addEventListener("close", async () => {
			if (memberDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(memberForm);
			const ok = await appConfirm({
				title: t("iam.breweries.add_member"),
				message: t("js.iam.add_member_message"),
			});
			if (!ok) {
				return;
			}
			try {
				await api("/api/breweries/" + fd.get("brewery_id") + "/members", {
					method: "POST",
					body: JSON.stringify({
						user_id: parseInt(fd.get("user_id"), 10),
						role: fd.get("role"),
					}),
				});
				await appInfo({ title: noticeTitle(), message: t("js.iam.member_added") });
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		const breweriesImportFile = panel.querySelector("#iam-breweries-import-file");
		if (breweriesImportFile) {
			breweriesImportFile.addEventListener("change", async () => {
				const file = breweriesImportFile.files && breweriesImportFile.files[0];
				if (!file) {
					return;
				}
				try {
					const result = await importCSVAuth("/api/breweries/import", file);
					await appInfo({
						title: t("js.inventory.import_result"),
						message: formatImportResult(result || {}),
					});
					refreshBreweries();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				} finally {
					breweriesImportFile.value = "";
				}
			});
		}

		const membersImportFile = panel.querySelector("#iam-members-import-file");
		if (membersImportFile) {
			membersImportFile.addEventListener("change", async () => {
				const file = membersImportFile.files && membersImportFile.files[0];
				if (!file) {
					return;
				}
				try {
					const result = await importCSVAuth("/api/breweries/members/import", file);
					await appInfo({
						title: t("js.inventory.import_result"),
						message: formatImportResult(result || {}),
					});
					refreshBreweries();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				} finally {
					membersImportFile.value = "";
				}
			});
		}

		refreshBreweries();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["iam-breweries"] = loadIAMBreweries;
})();
