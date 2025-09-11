export async function getIpInfo() {
    try {
      const xhr = new XMLHttpRequest();
      let url = "https://st1.sv-en.ru/backend/getIP.php" + url_sep("https://r1.sv-en.ru:6443/backend/getIP.php");
  
      // Фиксированные параметры на основе settings
      const mpot = false;
      const getIp_ispInfo = true;
      const getIp_ispInfo_distance = "km";
  
      if (mpot) {
        url += "cors=true&";
      }
      if (getIp_ispInfo) {
        url += "isp=true";
        if (getIp_ispInfo_distance) {
          url += "&distance=" + getIp_ispInfo_distance + "&";
        } else {
          url += "&";
        }
      }
      url += "r=" + Math.random();
  
      xhr.open("GET", url, true);
  
      // Используем Promise для асинхронного ожидания ответа
      const response = await new Promise((resolve, reject) => {
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`Запрос завершился с ошибкой: ${xhr.statusText}`));
          }
        };
  
        xhr.onerror = function () {
          reject(new Error("Произошла сетевая ошибка при выполнении запроса"));
        };
  
        xhr.send();
      });
  
      return response; // Возвращаем текст ответа
    } catch (error) {
      throw error; // Передаем ошибку дальше
    }
  }
  
  // Вспомогательная функция url_sep
  function url_sep(url) {
    return url.match(/\?/) ? "&" : "?";
  }
 