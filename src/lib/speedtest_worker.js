// данные, передаваемые в основной поток
let testState = -1; // -1=не начат, 0=начало, 1=тест скачивания, 2=тест пинга+джиттера, 3=тест загрузки, 4=завершен, 5=прерван
let dlStatus = ""; // скорость скачивания в мегабит/с с 2 знаками после запятой
let ulStatus = ""; // скорость загрузки в мегабит/с с 2 знаками после запятой
let pingStatus = ""; // пинг в миллисекундах с 2 знаками после запятой
let jitterStatus = ""; // джиттер в миллисекундах с 2 знаками после запятой
let clientIp = ""; // IP-адрес клиента, полученный от getIP.php
let dlProgress = 0; // прогресс теста скачивания 0-1
let ulProgress = 0; // прогресс теста загрузки 0-1
let pingProgress = 0; // прогресс теста пинга+джиттера 0-1
let testId = null; // ID теста (возвращается телеметрией, если используется, иначе null)

let log = ""; // лог телеметрии
function tlog(s) {
	if (settings.telemetry_level >= 2) {
		log += Date.now() + ": " + s + "\n";
	}
}
function tverb(s) {
	if (settings.telemetry_level >= 3) {
		log += Date.now() + ": " + s + "\n";
	}
}
function twarn(s) {
	if (settings.telemetry_level >= 2) {
		log += Date.now() + " WARN: " + s + "\n";
	}
	console.warn(s);
}

// настройки теста. могут быть переопределены при запуске команды
let settings = {
    mpot: false, // установить в true для режима MPOT
    test_order: "IP_D_U", // порядок тестов: D=Скачивание, U=Загрузка, P=Пинг+джиттер, I=IP, _=задержка 1 сек
    time_ul_max: 14, // макс. длительность теста загрузки в секундах
    time_dl_max: 14, // макс. длительность теста скачивания в секундах
    time_auto: true, // если true, тесты занимают меньше времени на быстрых соединениях
    time_ulGraceTime: 3, // время ожидания перед измерением загрузки (сек)
    time_dlGraceTime: 2, // время ожидания перед измерением скачивания (сек)
    count_ping: 10, // количество пингов для теста
    url_dl: "https://r1.sv-en.ru:6443/backend/garbage.php", // путь к файлу для теста скачивания
    url_ul: "https://r1.sv-en.ru:6443/backend/empty.php", // путь к файлу для теста загрузки
    url_ping: "https://r1.sv-en.ru:6443/backend/empty.php", // путь к файлу для теста пинга
    url_getIp: "https://r1.sv-en.ru:6443/backend/getIP.php", // путь к getIP.php
    getIp_ispInfo: true, // включать информацию об ISP с IP
    getIp_ispInfo_distance: "km", // оценка расстояния до сервера в км/милях
    xhr_dlMultistream: 10, // количество потоков скачивания
    xhr_ulMultistream: 5, // количество потоков загрузки
    xhr_multistreamDelay: 1000, // задержка между запросами (мс)
    xhr_ignoreErrors: 2, // 0=сбой при ошибках, 1=перезапуск потока, 2=игнорировать
    xhr_dlUseBlob: false, // использовать blob для скачивания
    xhr_ul_blob_megabytes: 10, // размер блобов для загрузки (МБ)
    garbagePhp_chunkSize: 10, // размер чанков garbage.php
    enable_quirks: true, // особенности для браузеров
    ping_allowPerformanceApi: true, // использовать Performance API для пинга
    overheadCompensationFactor: 1.1, // компенсация накладных расходов
    useMebibits: false, // использовать мебибиты вместо мегабит
    telemetry_level: 0, // 0=откл, 1=базовый, 2=полный, 3=отладка
    url_telemetry: "https://r1.sv-en.ru:6443/results/telemetry.php", // путь к скрипту телеметрии
    telemetry_extra: "", // доп. данные для телеметрии
    forceIE11Workaround: false // обходной путь для IE11
};

let xhr = null; // массив активных xhr-запросов
let interval = null; // таймер для тестов
let test_pointer = 0; // указатель на следующий тест

function url_sep(url) {
	return url.match(/\?/) ? "&" : "?";
}

// слушатель команд от основного потока
self.addEventListener("message", function(e) {
	const params = e.data.split(" ");
	if (params[0] === "status") {
		self.postMessage(
			JSON.stringify({
				testState: testState,
				dlStatus: dlStatus,
				ulStatus: ulStatus,
				pingStatus: pingStatus,
				clientIp: clientIp,
				jitterStatus: jitterStatus,
				dlProgress: dlProgress,
				ulProgress: ulProgress,
				pingProgress: pingProgress,
				testId: testId
			})
		);
	}
	if (params[0] === "start" && testState === -1) {
		testState = 0;
		try {
			let s = {};
			try {
				const ss = e.data.substring(5);
				if (ss) s = JSON.parse(ss);
			} catch (e) {
				twarn("Ошибка парсинга JSON настроек. Проверьте синтаксис");
			}
			for (let key in s) {
				if (typeof settings[key] !== "undefined") settings[key] = s[key];
				else twarn("Неизвестная настройка проигнорирована: " + key);
			}
			const ua = navigator.userAgent;
			if (settings.enable_quirks || (typeof s.enable_quirks !== "undefined" && s.enable_quirks)) {
				if (/Firefox.(\d+\.\d+)/i.test(ua)) {
					if (typeof s.ping_allowPerformanceApi === "undefined") {
						settings.ping_allowPerformanceApi = false;
					}
				}
				if (/Edge.(\d+\.\d+)/i.test(ua)) {
					if (typeof s.xhr_dlMultistream === "undefined") {
						settings.xhr_dlMultistream = 3;
					}
				}
				if (/Chrome.(\d+)/i.test(ua) && !!self.fetch) {
					if (typeof s.xhr_dlMultistream === "undefined") {
						settings.xhr_dlMultistream = 5;
					}
				}
			}
			if (/Edge.(\d+\.\d+)/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			if (/PlayStation 4.(\d+\.\d+)/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			if (/Chrome.(\d+)/i.test(ua) && /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)) {
				settings.xhr_ul_blob_megabytes = 4;
			}
			if (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			if (typeof s.telemetry_level !== "undefined") settings.telemetry_level = s.telemetry_level === "basic" ? 1 : s.telemetry_level === "full" ? 2 : s.telemetry_level === "debug" ? 3 : 0;
			settings.test_order = settings.test_order.toUpperCase();
		} catch (e) {
			twarn("Ошибка в настройках теста. Некоторые настройки не применены. Исключение: " + e);
		}
		tverb(JSON.stringify(settings));
		test_pointer = 0;
		let iRun = false,
			dRun = false,
			uRun = false,
			pRun = false;
		const runNextTest = function() {
			if (testState == 5) return;
			if (test_pointer >= settings.test_order.length) {
				if (settings.telemetry_level > 0)
					sendTelemetry(function(id) {
						testState = 4;
						if (id != null) testId = id;
					});
				else testState = 4;
				return;
			}
			switch (settings.test_order.charAt(test_pointer)) {
				case "I":
					{
						test_pointer++;
						if (iRun) {
							runNextTest();
							return;
						} else iRun = true;
						getIp(runNextTest);
					}
					break;
				case "D":
					{
						test_pointer++;
						if (dRun) {
							runNextTest();
							return;
						} else dRun = true;
						testState = 1;
						dlTest(runNextTest);
					}
					break;
				case "U":
					{
						test_pointer++;
						if (uRun) {
							runNextTest();
							return;
						} else uRun = true;
						testState = 3;
						ulTest(runNextTest);
					}
					break;
				case "P":
					{
						test_pointer++;
						if (pRun) {
							runNextTest();
							return;
						} else pRun = true;
						testState = 2;
						pingTest(runNextTest);
					}
					break;
				case "_":
					{
						test_pointer++;
						setTimeout(runNextTest, 1000);
					}
					break;
				default:
					test_pointer++;
			}
		};
		runNextTest();
	}
	if (params[0] === "abort") {
		if (testState >= 4) return;
		tlog("прервано вручную");
		clearRequests();
		runNextTest = null;
		if (interval) clearInterval(interval);
		if (settings.telemetry_level > 1) sendTelemetry(function() {});
		testState = -1;
		dlStatus = "";
		ulStatus = "";
		pingStatus = "";
		jitterStatus = "";
		clientIp = "";
		dlProgress = 0;
		ulProgress = 0;
		pingProgress = 0;
	}
});

function clearRequests() {
	tverb("остановка активных XHR");
	if (xhr) {
		for (let i = 0; i < xhr.length; i++) {
			try {
				xhr[i].onprogress = null;
				xhr[i].onload = null;
				xhr[i].onerror = null;
			} catch (e) {}
			try {
				xhr[i].upload.onprogress = null;
				xhr[i].upload.onload = null;
				xhr[i].upload.onerror = null;
			} catch (e) {}
			try {
				xhr[i].abort();
			} catch (e) {}
			try {
				delete xhr[i];
			} catch (e) {}
		}
		xhr = null;
	}
}

let ipCalled = false;
let ispInfo = "";
function getIp(done) {
	tverb("getIp");
	if (ipCalled) return;
	else ipCalled = true;
	let startT = new Date().getTime();
	xhr = new XMLHttpRequest();
	xhr.onload = function() {
		tlog("IP: " + xhr.responseText + ", заняло " + (new Date().getTime() - startT) + "ms");
		try {
			const data = JSON.parse(xhr.responseText);
			clientIp = data.processedString;
			ispInfo = data.rawIspInfo;
		} catch (e) {
			clientIp = xhr.responseText;
			ispInfo = "";
		}
		done();
	};
	xhr.onerror = function() {
		tlog("getIp не удался, заняло " + (new Date().getTime() - startT) + "ms");
		done();
	};
	xhr.open("GET", settings.url_getIp + url_sep(settings.url_getIp) + (settings.mpot ? "cors=true&" : "") + (settings.getIp_ispInfo ? "isp=true" + (settings.getIp_ispInfo_distance ? "&distance=" + settings.getIp_ispInfo_distance + "&" : "&") : "&") + "r=" + Math.random(), true);
	xhr.send();
}

let dlCalled = false;
function dlTest(done) {
	tverb("dlTest");
	if (dlCalled) return;
	else dlCalled = true;
	let totLoaded = 0.0,
		startT = new Date().getTime(),
		bonusT = 0,
		graceTimeDone = false,
		failed = false;
	xhr = [];
	const testStream = function(i, delay) {
		setTimeout(
			function() {
				if (testState !== 1) return;
				tverb("запуск потока dl " + i + " " + delay);
				let prevLoaded = 0;
				let x = new XMLHttpRequest();
				xhr[i] = x;
				xhr[i].onprogress = function(event) {
					tverb("событие прогресса dl " + i + " " + event.loaded);
					if (testState !== 1) {
						try {
							x.abort();
						} catch (e) {}
					}
					const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
					if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;
					totLoaded += loadDiff;
					prevLoaded = event.loaded;
				}.bind(self);
				xhr[i].onload = function() {
					tverb("поток dl завершен " + i);
					try {
						xhr[i].abort();
					} catch (e) {}
					testStream(i, 0);
				}.bind(self);
				xhr[i].onerror = function() {
					tverb("поток dl не удался " + i);
					if (settings.xhr_ignoreErrors === 0) failed = true;
					try {
						xhr[i].abort();
					} catch (e) {}
					delete xhr[i];
					if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
				}.bind(self);
				try {
					if (settings.xhr_dlUseBlob) xhr[i].responseType = "blob";
					else xhr[i].responseType = "arraybuffer";
				} catch (e) {}
				xhr[i].open("GET", settings.url_dl + url_sep(settings.url_dl) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random() + "&ckSize=" + settings.garbagePhp_chunkSize, true);
				xhr[i].send();
			}.bind(self),
			1 + delay
		);
	}.bind(self);
	for (let i = 0; i < settings.xhr_dlMultistream; i++) {
		testStream(i, settings.xhr_multistreamDelay * i);
	}
	interval = setInterval(
		function() {
			tverb("DL: " + dlStatus + (graceTimeDone ? "" : " (в график тайм)"));
			const t = new Date().getTime() - startT;
			if (graceTimeDone) dlProgress = (t + bonusT) / (settings.time_dl_max * 1000);
			if (t < 200) return;
			if (!graceTimeDone) {
				if (t > 1000 * settings.time_dlGraceTime) {
					if (totLoaded > 0) {
						startT = new Date().getTime();
						bonusT = 0;
						totLoaded = 0.0;
					}
					graceTimeDone = true;
				}
			} else {
				const speed = totLoaded / (t / 1000.0);
				if (settings.time_auto) {
					const bonus = (5.0 * speed) / 100000;
					bonusT += bonus > 400 ? 400 : bonus;
				}
				dlStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
				if ((t + bonusT) / 1000.0 > settings.time_dl_max || failed) {
					if (failed || isNaN(dlStatus)) dlStatus = "Fail";
					clearRequests();
					clearInterval(interval);
					dlProgress = 1;
					tlog("dlTest: " + dlStatus + ", заняло " + (new Date().getTime() - startT) + "ms");
					done();
				}
			}
		}.bind(self),
		200
	);
}

let ulCalled = false;
function ulTest(done) {
	tverb("ulTest");
	if (ulCalled) return;
	else ulCalled = true;
	let r = new ArrayBuffer(1048576);
	const maxInt = Math.pow(2, 32) - 1;
	try {
		r = new Uint32Array(r);
		for (let i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
	} catch (e) {}
	let req = [];
	let reqsmall = [];
	for (let i = 0; i < settings.xhr_ul_blob_megabytes; i++) req.push(r);
	req = new Blob(req);
	r = new ArrayBuffer(262144);
	try {
		r = new Uint32Array(r);
		for (let i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
	} catch (e) {}
	reqsmall.push(r);
	reqsmall = new Blob(reqsmall);
	const testFunction = function() {
		let totLoaded = 0.0,
			startT = new Date().getTime(),
			bonusT = 0,
			graceTimeDone = false,
			failed = false;
		xhr = [];
		const testStream = function(i, delay) {
			setTimeout(
				function() {
					if (testState !== 3) return;
					tverb("запуск потока ul " + i + " " + delay);
					let prevLoaded = 0;
					let x = new XMLHttpRequest();
					xhr[i] = x;
					let ie11workaround;
					if (settings.forceIE11Workaround) ie11workaround = true;
					else {
						try {
							xhr[i].upload.onprogress;
							ie11workaround = false;
						} catch (e) {
							ie11workaround = true;
						}
					}
					if (ie11workaround) {
						xhr[i].onload = xhr[i].onerror = function() {
							tverb("событие прогресса ul (ie11wa)");
							totLoaded += reqsmall.size;
							testStream(i, 0);
						};
						xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
						try {
							xhr[i].setRequestHeader("Content-Encoding", "identity");
						} catch (e) {}
						xhr[i].send(reqsmall);
					} else {
						xhr[i].upload.onprogress = function(event) {
							tverb("событие прогресса ul " + i + " " + event.loaded);
							if (testState !== 3) {
								try {
									x.abort();
								} catch (e) {}
							}
							const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
							if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;
							totLoaded += loadDiff;
							prevLoaded = event.loaded;
						}.bind(self);
						xhr[i].upload.onload = function() {
							tverb("поток ul завершен " + i);
							testStream(i, 0);
						}.bind(self);
						xhr[i].upload.onerror = function() {
							tverb("поток ul не удался " + i);
							if (settings.xhr_ignoreErrors === 0) failed = true;
							try {
								xhr[i].abort();
							} catch (e) {}
							delete xhr[i];
							if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
						}.bind(self);
						xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
						try {
							xhr[i].setRequestHeader("Content-Encoding", "identity");
						} catch (e) {}
						xhr[i].send(req);
					}
				}.bind(self),
				delay
			);
		}.bind(self);
		for (let i = 0; i < settings.xhr_ulMultistream; i++) {
			testStream(i, settings.xhr_multistreamDelay * i);
		}
		interval = setInterval(
			function() {
				tverb("UL: " + ulStatus + (graceTimeDone ? "" : " (в график тайм)"));
				const t = new Date().getTime() - startT;
				if (graceTimeDone) ulProgress = (t + bonusT) / (settings.time_ul_max * 1000);
				if (t < 200) return;
				if (!graceTimeDone) {
					if (t > 1000 * settings.time_ulGraceTime) {
						if (totLoaded > 0) {
							startT = new Date().getTime();
							bonusT = 0;
							totLoaded = 0.0;
						}
						graceTimeDone = true;
					}
				} else {
					const speed = totLoaded / (t / 1000.0);
					if (settings.time_auto) {
						const bonus = (5.0 * speed) / 100000;
						bonusT += bonus > 400 ? 400 : bonus;
					}
					ulStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
					if ((t + bonusT) / 1000.0 > settings.time_ul_max || failed) {
						if (failed || isNaN(ulStatus)) ulStatus = "Fail";
						clearRequests();
						clearInterval(interval);
						ulProgress = 1;
						tlog("ulTest: " + ulStatus + ", заняло " + (new Date().getTime() - startT) + "ms");
						done();
					}
				}
			}.bind(self),
			200
		);
	}.bind(self);
	if (settings.mpot) {
		tverb("Отправка POST-запроса перед тестом загрузки");
		xhr = [];
		xhr[0] = new XMLHttpRequest();
		xhr[0].onload = xhr[0].onerror = function() {
			tverb("POST-запрос отправлен, запуск теста загрузки");
			testFunction();
		}.bind(self);
		xhr[0].open("POST", settings.url_ul);
		xhr[0].send();
	} else testFunction();
}

let ptCalled = false;
function pingTest(done) {
	tverb("pingTest");
	if (ptCalled) return;
	else ptCalled = true;
	const startT = new Date().getTime();
	let prevT = null;
	let ping = 0.0;
	let jitter = 0.0;
	let i = 0;
	let prevInstspd = 0;
	xhr = [];
	const doPing = function() {
		tverb("ping");
		pingProgress = i / settings.count_ping;
		prevT = new Date().getTime();
		xhr[0] = new XMLHttpRequest();
		xhr[0].onload = function() {
			tverb("pong");
			if (i === 0) {
				prevT = new Date().getTime();
			} else {
				let instspd = new Date().getTime() - prevT;
				if (settings.ping_allowPerformanceApi) {
					try {
						let p = performance.getEntries();
						p = p[p.length - 1];
						let d = p.responseStart - p.requestStart;
						if (d <= 0) d = p.duration;
						if (d > 0 && d < instspd) instspd = d;
					} catch (e) {
						tverb("Performance API не поддерживается, используется оценка");
					}
				}
				if (instspd < 1) instspd = prevInstspd;
				if (instspd < 1) instspd = 1;
				const instjitter = Math.abs(instspd - prevInstspd);
				if (i === 1) ping = instspd;
				else {
					if (instspd < ping) ping = instspd;
					if (i === 2) jitter = instjitter;
					else jitter = instjitter > jitter ? jitter * 0.3 + instjitter * 0.7 : jitter * 0.8 + instjitter * 0.2;
				}
				prevInstspd = instspd;
			}
			pingStatus = ping.toFixed(2);
			jitterStatus = jitter.toFixed(2);
			i++;
			tverb("ping: " + pingStatus + " jitter: " + jitterStatus);
			if (i < settings.count_ping) doPing();
			else {
				pingProgress = 1;
				tlog("ping: " + pingStatus + " jitter: " + jitterStatus + ", заняло " + (new Date().getTime() - startT) + "ms");
				done();
			}
		}.bind(self);
		xhr[0].onerror = function() {
			tverb("ping не удался");
			if (settings.xhr_ignoreErrors === 0) {
				pingStatus = "Fail";
				jitterStatus = "Fail";
				clearRequests();
				tlog("тест пинга не удался, заняло " + (new Date().getTime() - startT) + "ms");
				pingProgress = 1;
				done();
			}
			if (settings.xhr_ignoreErrors === 1) doPing();
			if (settings.xhr_ignoreErrors === 2) {
				i++;
				if (i < settings.count_ping) doPing();
				else {
					pingProgress = 1;
					tlog("ping: " + pingStatus + " jitter: " + jitterStatus + ", заняло " + (new Date().getTime() - startT) + "ms");
					done();
				}
			}
		}.bind(self);
		xhr[0].open("GET", settings.url_ping + url_sep(settings.url_ping) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
		xhr[0].send();
	}.bind(self);
	doPing();
}

function sendTelemetry(done) {
	if (settings.telemetry_level < 1) return;
	xhr = new XMLHttpRequest();
	xhr.onload = function() {
		try {
			const parts = xhr.responseText.split(" ");
			if (parts[0] == "id") {
				try {
					let id = parts[1];
					done(id);
				} catch (e) {
					done(null);
				}
			} else done(null);
		} catch (e) {
			done(null);
		}
	};
	xhr.onerror = function() {
		console.log("ОШИБКА ТЕЛЕМЕТРИИ " + xhr.status);
		done(null);
	};
	xhr.open("POST", settings.url_telemetry + url_sep(settings.url_telemetry) + (settings.mpot ? "cors=true&" : "") + "r=" + Math.random(), true);
	const telemetryIspInfo = {
		processedString: clientIp,
		rawIspInfo: typeof ispInfo === "object" ? ispInfo : ""
	};
	try {
		const fd = new FormData();
		fd.append("ispinfo", JSON.stringify(telemetryIspInfo));
		fd.append("dl", dlStatus);
		fd.append("ul", ulStatus);
		fd.append("ping", pingStatus);
		fd.append("jitter", jitterStatus);
		fd.append("log", settings.telemetry_level > 1 ? log : "");
		fd.append("extra", settings.telemetry_extra);
		xhr.send(fd);
	} catch (ex) {
		const postData = "extra=" + encodeURIComponent(settings.telemetry_extra) + "&ispinfo=" + encodeURIComponent(JSON.stringify(telemetryIspInfo)) + "&dl=" + encodeURIComponent(dlStatus) + "&ul=" + encodeURIComponent(ulStatus) + "&ping=" + encodeURIComponent(pingStatus) + "&jitter=" + encodeURIComponent(jitterStatus) + "&log=" + encodeURIComponent(settings.telemetry_level > 1 ? log : "");
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		xhr.send(postData);
	}
}