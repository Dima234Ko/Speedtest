function Speedtest() {
  this._serverList = [];
  this._selectedServer = null;
  this._settings = {};
  this._state = 0;
}

Speedtest.prototype = {
  constructor: Speedtest,
  getState: function() { 
    console.log("Текущее состояние:", this._state);
    return this._state; 
  },
  setParameter: function(parameter, value) {
    if (this._state == 3) {
      console.error("Невозможно изменить настройки во время выполнения теста.");
      throw "You cannot change the test settings while running the test";
    }
    console.log(`Устанавливаем параметр: ${parameter} = ${value}`);
    this._settings[parameter] = value;
    if (parameter === "telemetry_extra") {
      this._originalExtra = this._settings.telemetry_extra;
    }
  },
  _checkServerDefinition: function(server) {
    try {
      if (typeof server.name !== "string") throw "Name string missing from server definition (name)";
      if (typeof server.server !== "string") throw "Server address string missing from server definition (server)";
      if (server.server.charAt(server.server.length - 1) != "/") server.server += "/";
      if (server.server.indexOf("//") == 0) server.server = location.protocol + server.server;
      if (typeof server.dlURL !== "string") throw "Download URL string missing from server definition (dlURL)";
      if (typeof server.ulURL !== "string") throw "Upload URL string missing from server definition (ulURL)";
      if (typeof server.pingURL !== "string") throw "Ping URL string missing from server definition (pingURL)";
      if (typeof server.getIpURL !== "string") throw "GetIP URL string missing from server definition (getIpURL)";
    } catch (e) {
      console.error("Ошибка в определении сервера:", e);
      throw "Invalid server definition";
    }
  },
  addTestPoint: function(server) {
    this._checkServerDefinition(server);
    if (this._state == 0) this._state = 1;
    if (this._state != 1) throw "You can't add a server after server selection";
    this._settings.mpot = true;
    this._serverList.push(server);
    console.log("Добавлен тестовый сервер:", server);
  },
  addTestPoints: function(list) {
    for (let i = 0; i < list.length; i++) this.addTestPoint(list[i]);
  },
  loadServerList: function(url, result) {
    console.log("Загружаем список серверов с URL: ", url);
    if (this._state == 0) this._state = 1;
    if (this._state != 1) throw "You can't add a server after server selection";
    this._settings.mpot = true;
    let xhr = new XMLHttpRequest();
    xhr.onload = function() {
      try {
        const servers = JSON.parse(xhr.responseText);
        console.log("Список серверов загружен:", servers);
        for (let i = 0; i < servers.length; i++) {
          this._checkServerDefinition(servers[i]);
        }
        this.addTestPoints(servers);
        result(servers);
      } catch (e) {
        console.error("Ошибка при обработке серверов:", e);
        result(null);
      }
    }.bind(this);
    xhr.onerror = function() {
      console.error("Ошибка при загрузке серверов.");
      result(null);
    };
    xhr.open("GET", url);
    xhr.send();
  },
  start: function({server}) {
    function getServer(server) {
      switch (server) {
        case 2:
          return `https://st2.sv-en.ru/`
        case 3:
          return `https://st3.sv-en.ru/`
        default:
          return `https://r1.sv-en.ru:6443/`
      }
    }
    
    let baseUrl = getServer (server);

    if (this._state == 3) throw "Test already running";

    // Логируем создание воркера
    console.log("Создаю воркер: ", new URL('speedtest_worker.js', import.meta.url).href + '?r=' + Math.random());
    this.worker = new Worker(new URL('speedtest_worker.js', import.meta.url).href + '?r=' + Math.random());
    this.worker.postMessage({ type: 'setServer', url: baseUrl });

    // Логируем worker после его создания
    console.log("Worker создан: ", this.worker);

    this.worker.onmessage = function(e) {
      if (e.data === this._prevData) return;
      else this._prevData = e.data;
      const data = JSON.parse(e.data);

      // Логируем данные, полученные от воркера
      console.log("Получены данные от Worker:", data);

      try {
        if (this.onupdate) this.onupdate(data);
      } catch (e) {
        console.error("Speedtest onupdate event threw exception: " + e);
      }

      if (data.testState >= 4) {
        clearInterval(this.updater);
        this._state = 4;

        // Логируем, когда тест завершен
        console.log("Тест завершен. Состояние теста:", data.testState);

        try {
          if (this.onend) this.onend(data.testState == 5);
        } catch (e) {
          console.error("Speedtest onend event threw exception: " + e);
        }
      }
    }.bind(this);

    // Логируем процесс отправки сообщений
    this.updater = setInterval(function() {
      console.log("Отправка запроса 'status' воркеру...");
      this.worker.postMessage("status");
    }.bind(this), 200);

    // Логирование состояния перед запуском
    console.log("Текущее состояние перед запуском:", this._state);

    if (this._state == 1) throw "When using multiple points of test, you must call selectServer before starting the test";
    if (this._state == 2) {
      this._settings.url_dl = this._selectedServer.server + this._selectedServer.dlURL;
      this._settings.url_ul = this._selectedServer.server + this._selectedServer.ulURL;
      this._settings.url_ping = this._selectedServer.server + this._selectedServer.pingURL;
      this._settings.url_getIp = this._selectedServer.server + this._selectedServer.getIpURL;

      if (typeof this._originalExtra !== "undefined") {
        this._settings.telemetry_extra = JSON.stringify({
          server: this._selectedServer.name,
          extra: this._originalExtra
        });
      } else {
        this._settings.telemetry_extra = JSON.stringify({
          server: this._selectedServer.name
        });
      }
    }

    this._state = 3;
    console.log("Тест начинается. Отправка данных в воркер...");
    this.worker.postMessage("start " + JSON.stringify(this._settings));
  },
  abort: function() {
    if (this._state < 3) throw "You cannot abort a test that's not started yet";
    if (this._state < 4) this.worker.postMessage("abort");
  }
};

export default Speedtest;
