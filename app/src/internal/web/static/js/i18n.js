(function (global) {
	const STORAGE_KEY = "brewhouse_regional";
	const SUPPORTED_LANGUAGES = ["en", "sv", "nb", "da", "fi", "de", "es", "fr", "pl"];
	const SUPPORTED_CURRENCIES = ["SEK", "EUR", "USD", "NOK", "DKK", "PLN"];
	const SUPPORTED_GRAVITY = ["sg", "plato"];
	const catalogs = Object.fromEntries(SUPPORTED_LANGUAGES.map(function (code) {
		return [code, {}];
	}));
	let language = "en";
	let currency = "SEK";
	let gravityUnit = "sg";
	let ready = false;

	function isSupportedLanguage(lang) {
		return SUPPORTED_LANGUAGES.indexOf(lang) >= 0;
	}

	function isSupportedCurrency(code) {
		return SUPPORTED_CURRENCIES.indexOf(code) >= 0;
	}

	function isSupportedGravity(unit) {
		return SUPPORTED_GRAVITY.indexOf(unit) >= 0;
	}

	function loadCache() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) {
				return;
			}
			const o = JSON.parse(raw);
			if (isSupportedLanguage(o.language)) {
				language = o.language;
			}
			if (isSupportedCurrency(o.currency_code)) {
				currency = o.currency_code;
			}
			if (isSupportedGravity(o.gravity_unit)) {
				gravityUnit = o.gravity_unit;
			}
		} catch (_) {
			/* ignore */
		}
	}

	function saveCache() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					language: language,
					currency_code: currency,
					gravity_unit: gravityUnit,
				})
			);
		} catch (_) {
			/* ignore */
		}
	}

	function interpolate(str, vars) {
		if (str == null) {
			return str;
		}
		const v = Object.assign({ currency: currency }, vars || {});
		return String(str).replace(/\{(\w+)\}/g, function (_, k) {
			return v[k] != null ? String(v[k]) : "{" + k + "}";
		});
	}

	function t(key, vars) {
		const cat = catalogs[language] || catalogs.en || {};
		const fallback = catalogs.en || {};
		const raw = cat[key] != null ? cat[key] : fallback[key];
		if (raw == null) {
			return key;
		}
		return interpolate(raw, vars);
	}

	function applyAttrs(el) {
		const spec = el.getAttribute("data-i18n-attr");
		if (!spec) {
			return;
		}
		spec.split(";").forEach(function (part) {
			const idx = part.indexOf(":");
			if (idx < 0) {
				return;
			}
			const attr = part.slice(0, idx).trim();
			const key = part.slice(idx + 1).trim();
			if (attr && key) {
				el.setAttribute(attr, t(key));
			}
		});
	}

	function applyGravityLabels(scope) {
		(scope || document).querySelectorAll("[data-gravity-label]").forEach(function (el) {
			const mode = el.getAttribute("data-gravity-label");
			let key;
			if (mode === "og") {
				key = gravityUnit === "plato" ? "brewday.og_plato" : "brewday.og";
			} else if (mode === "fg") {
				key = gravityUnit === "plato" ? "delivery.fg_plato" : "delivery.fg";
			} else if (mode === "common-og") {
				key = gravityUnit === "plato" ? "common.og_plato" : "common.og";
			} else if (mode === "common-fg") {
				key = gravityUnit === "plato" ? "common.fg_plato" : "common.fg";
			}
			if (key) {
				el.textContent = t(key);
			}
		});
	}

	function applyI18n(root) {
		const scope = root || document;
		scope.querySelectorAll("[data-i18n]").forEach(function (el) {
			const key = el.getAttribute("data-i18n");
			if (!key) {
				return;
			}
			el.textContent = t(key);
		});
		scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
			const key = el.getAttribute("data-i18n-html");
			if (!key) {
				return;
			}
			el.innerHTML = t(key);
		});
		scope.querySelectorAll("[data-i18n-attr]").forEach(applyAttrs);
		applyGravityLabels(scope);
		if (document.documentElement) {
			document.documentElement.lang = language;
		}
	}

	async function loadCatalogs() {
		await Promise.all(
			SUPPORTED_LANGUAGES.map(async function (code) {
				const res = await fetch("/static/i18n/" + code + ".json");
				if (res.ok) {
					catalogs[code] = await res.json();
				}
			})
		);
		ready = true;
	}

	function setLanguage(lang) {
		if (isSupportedLanguage(lang)) {
			language = lang;
			saveCache();
			applyI18n(document);
		}
	}

	function setCurrency(code) {
		if (isSupportedCurrency(code)) {
			currency = code;
			saveCache();
			applyI18n(document);
		}
	}

	async function applyRegional(cfg) {
		if (!cfg) {
			return;
		}
		if (cfg.currency_code) {
			currency = cfg.currency_code;
		}
		if (cfg.language) {
			language = cfg.language;
		}
		if (isSupportedGravity(cfg.gravity_unit)) {
			gravityUnit = cfg.gravity_unit;
		}
		saveCache();
		if (!ready) {
			await loadCatalogs();
		}
		applyI18n(document);
	}

	function currencyCode() {
		return currency;
	}

	function currencySuffix() {
		return " " + currency;
	}

	function currencyPerLiter() {
		return currency + "/L";
	}

	function getLanguage() {
		return language;
	}

	function getGravityUnit() {
		return gravityUnit;
	}

	loadCache();

	global.BH_I18N = {
		t: t,
		applyI18n: applyI18n,
		setLanguage: setLanguage,
		setCurrency: setCurrency,
		applyRegional: applyRegional,
		currencyCode: currencyCode,
		currencySuffix: currencySuffix,
		currencyPerLiter: currencyPerLiter,
		getLanguage: getLanguage,
		gravityUnit: getGravityUnit,
		applyGravityLabels: applyGravityLabels,
		loadCatalogs: loadCatalogs,
		loadCache: loadCache,
		saveCache: saveCache,
	};

	loadCatalogs().then(function () {
		applyI18n(document);
	});
})(window);
