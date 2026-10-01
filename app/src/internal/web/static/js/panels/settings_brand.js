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

	async function loadSettingsBrand(panel) {
		const logoPreview = panel.querySelector("#settings-logo-preview");
		const faviconPreview = panel.querySelector("#settings-favicon-preview");
		const logoErr = panel.querySelector("#settings-logo-error");
		const faviconErr = panel.querySelector("#settings-favicon-error");
		const bgHexInput = panel.querySelector("#settings-logo-bg-hex");
		const bgPicker = panel.querySelector("#settings-logo-bg-picker");
		const bgErr = panel.querySelector("#settings-logo-bg-error");
		const defaultBg = "#6c704a";

		function applyBgLocal(hex) {
			const color = hex || defaultBg;
			if (bgHexInput) {
				bgHexInput.value = color;
			}
			if (bgPicker) {
				bgPicker.value = color;
			}
			if (window.BrewhouseAuth && typeof window.BrewhouseAuth.applyWelcomeLogoBg === "function") {
				window.BrewhouseAuth.applyWelcomeLogoBg(color);
			}
		}

		function bustBrand(kind) {
			const url = "/" + kind + "?t=" + Date.now();
			if (kind === "logo") {
				if (logoPreview) {
					logoPreview.src = url;
				}
				document.querySelectorAll(".splash__logo, .login__logo, .shell__brand-logo, .shell__welcome-logo").forEach((img) => {
					img.src = url;
				});
			} else {
				if (faviconPreview) {
					faviconPreview.src = url;
				}
				const link = document.querySelector('link[rel="icon"]');
				if (link) {
					link.href = url;
				}
			}
		}

		async function uploadBrand(kind, fileInput, errEl) {
			errEl.hidden = true;
			const file = fileInput.files && fileInput.files[0];
			if (!file) {
				errEl.hidden = false;
				errEl.textContent = t("js.iam.choose_file");
				return;
			}
			const fd = new FormData();
			fd.append(kind, file);
			const res = await fetch("/api/settings/" + kind, {
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
			bustBrand(kind);
		}

		async function resetBrand(kind, errEl) {
			errEl.hidden = true;
			await api("/api/settings/" + kind, { method: "DELETE" });
			bustBrand(kind);
		}

		bustBrand("logo");
		bustBrand("favicon");

		try {
			const cfg = await api("/api/settings/brand-color");
			applyBgLocal((cfg && cfg.logo_bg_hex) || defaultBg);
		} catch (e) {
			applyBgLocal(defaultBg);
		}

		if (bgHexInput && bgPicker) {
			bgHexInput.addEventListener("input", () => {
				const v = bgHexInput.value.trim();
				if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
					bgPicker.value = v.toLowerCase();
				}
			});
			bgPicker.addEventListener("input", () => {
				bgHexInput.value = bgPicker.value;
			});
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const action = el.getAttribute("data-action");
			if (action === "settings-logo-upload") {
				try {
					await uploadBrand("logo", panel.querySelector("#settings-logo-file"), logoErr);
				} catch (e) {
					logoErr.hidden = false;
					logoErr.textContent = e.message;
				}
			}
			if (action === "settings-logo-reset") {
				try {
					await resetBrand("logo", logoErr);
				} catch (e) {
					logoErr.hidden = false;
					logoErr.textContent = e.message;
				}
			}
			if (action === "settings-favicon-upload") {
				try {
					await uploadBrand(
						"favicon",
						panel.querySelector("#settings-favicon-file"),
						faviconErr
					);
				} catch (e) {
					faviconErr.hidden = false;
					faviconErr.textContent = e.message;
				}
			}
			if (action === "settings-favicon-reset") {
				try {
					await resetBrand("favicon", faviconErr);
				} catch (e) {
					faviconErr.hidden = false;
					faviconErr.textContent = e.message;
				}
			}
			if (action === "settings-logo-bg-save") {
				bgErr.hidden = true;
				try {
					const hex = (bgHexInput && bgHexInput.value.trim()) || "";
					const cfg = await api("/api/settings/brand-color", {
						method: "PUT",
						body: JSON.stringify({ logo_bg_hex: hex }),
					});
					applyBgLocal((cfg && cfg.logo_bg_hex) || defaultBg);
				} catch (e) {
					bgErr.hidden = false;
					bgErr.textContent = e.message;
				}
			}
			if (action === "settings-logo-bg-reset") {
				bgErr.hidden = true;
				try {
					const cfg = await api("/api/settings/brand-color", { method: "DELETE" });
					applyBgLocal((cfg && cfg.logo_bg_hex) || defaultBg);
				} catch (e) {
					bgErr.hidden = false;
					bgErr.textContent = e.message;
				}
			}
		});
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["settings-brand"] = loadSettingsBrand;
})();
