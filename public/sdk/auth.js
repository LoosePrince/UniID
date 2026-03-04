(function () {
  function AuthSDK(config) {
    this.authServer = config.authServer.replace(/\/+$/, "");
    this.appId = config.appId;
    this.token = null;
    this.iframe = null;
    this.loginResolver = null;
    this._init();
  }

  AuthSDK.prototype._init = function () {
    if (this.iframe) return;
    var iframe = document.createElement("iframe");
    iframe.src = this.authServer + "/embed?app_id=" + encodeURIComponent(this.appId);
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    this.iframe = iframe;

    var self = this;
    window.addEventListener("message", function (event) {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "uniid_login_success") {
        if (event.data.token) {
          self.token = event.data.token;
        }
        if (self.loginResolver) {
          self.loginResolver({
            token: event.data.token,
            user: event.data.user || null
          });
          self.loginResolver = null;
        }
      }
    });
  };

  AuthSDK.prototype.login = function () {
    var self = this;
    return new Promise(function (resolve) {
      self.loginResolver = resolve;
      if (!self.iframe) {
        self._init();
      }
      if (self.iframe) {
        self.iframe.style.display = "block";
        self.iframe.focus();
        self.iframe.contentWindow &&
          self.iframe.contentWindow.postMessage(
            { type: "uniid_open_login" },
            self.authServer
          );
      }
    }).finally(function () {
      if (self.iframe) {
        self.iframe.style.display = "none";
      }
    });
  };

  AuthSDK.prototype._fetch = function (method, path, body) {
    if (!this.token) {
      return Promise.reject(new Error("NO_TOKEN"));
    }
    var url = this.authServer + path;
    var headers = {
      Authorization: "Bearer " + this.token
    };
    var init = {
      method: method,
      headers: headers,
      credentials: "include"
    };
    if (body != null) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(url, init).then(function (res) {
      if (!res.ok) {
        var err = new Error("Request failed with status " + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    });
  };

  AuthSDK.prototype.create = function (type, data, permissions) {
    return this._fetch("POST", "/api/data/" + encodeURIComponent(this.appId) + "/" + encodeURIComponent(type), {
      data: data,
      permissions: permissions || undefined
    });
  };

  AuthSDK.prototype.read = function (recordId) {
    return this._fetch("GET", "/api/data/" + encodeURIComponent(recordId));
  };

  window.AuthSDK = AuthSDK;
})();

