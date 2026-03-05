(function () {
  function AuthSDK(config) {
    if (!config || !config.mountId) {
      throw new Error("AuthSDK: mountId is required to initialize iframe.");
    }
    this.authServer = config.authServer.replace(/\/+$/, "");
    this.appId = config.appId;
    this.mountId = config.mountId;
    this.token = null;
    this.iframe = null;
    this.loginResolver = null;
    this._restoreTokenFromCookie();
    this._init();
  }

  AuthSDK.prototype._getCookie = function (name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) {
      return parts.pop().split(";").shift() || null;
    }
    return null;
  };

  AuthSDK.prototype._setCookie = function (name, value, maxAgeSeconds) {
    var cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; SameSite=Lax";
    if (typeof maxAgeSeconds === "number") {
      cookie += "; max-age=" + String(maxAgeSeconds);
    }
    document.cookie = cookie;
  };

  AuthSDK.prototype._restoreTokenFromCookie = function () {
    var token = this._getCookie("uniid_sdk_token");
    if (token) {
      this.token = token;
    }
  };

  AuthSDK.prototype._init = function () {
    if (this.iframe) return;
    var mount = document.getElementById(this.mountId);
    if (!mount || !mount.parentNode) {
      throw new Error(
        "AuthSDK: mount element with id '" + this.mountId + "' not found."
      );
    }
    var iframe = document.createElement("iframe");
    iframe.src = this.authServer + "/embed?app_id=" + encodeURIComponent(this.appId);
    iframe.id = mount.id;
    iframe.className = mount.className;
    iframe.title = "UniID 授权窗口";
    iframe.style.display = "none";
    mount.parentNode.replaceChild(iframe, mount);
    this.iframe = iframe;

    var self = this;
    window.addEventListener("message", function (event) {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "uniid_login_success") {
        if (event.data.token) {
          self.token = event.data.token;
          self._setCookie("uniid_sdk_token", event.data.token, event.data.expires_in || 3600);
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
      this._restoreTokenFromCookie();
    }
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
    return this._fetch("GET", "/api/data/record/" + encodeURIComponent(recordId));
  };

  AuthSDK.prototype.update = function (recordId, data, permissions) {
    var body = {};
    if (data != null) {
      body.data = data;
    }
    if (permissions != null) {
      body.permissions = permissions;
    }
    return this._fetch("PATCH", "/api/data/record/" + encodeURIComponent(recordId), body);
  };

  AuthSDK.prototype.delete = function (recordId) {
    return this._fetch("DELETE", "/api/data/record/" + encodeURIComponent(recordId));
  };

  AuthSDK.prototype.deleteField = function (recordId, fieldPath) {
    return this._fetch(
      "DELETE",
      "/api/data/record/" + encodeURIComponent(recordId) + "/fields/" + encodeURIComponent(fieldPath)
    );
  };

  AuthSDK.prototype.query = function (queryParams) {
    var params = queryParams || {};
    params.app_id = this.appId;
    return this._fetch("POST", "/api/data/query", params);
  };

  AuthSDK.prototype.revoke = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.token) {
        self._restoreTokenFromCookie();
      }
      if (!self.token) {
        reject(new Error("NO_TOKEN"));
        return;
      }
      var url = self.authServer + "/api/auth/revoke";
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + self.token
        },
        credentials: "include",
        body: JSON.stringify({
          app_id: self.appId
        })
      })
        .then(function (res) {
          if (!res.ok) {
            var err = new Error("Revoke failed with status " + res.status);
            err.status = res.status;
            throw err;
          }
          return res.json();
        })
        .then(function (data) {
          // 清除本地 token
          self.token = null;
          self._setCookie("uniid_sdk_token", "", 0);
          resolve(data);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  };

  AuthSDK.prototype.logout = function () {
    return this.revoke();
  };

  window.AuthSDK = AuthSDK;
})();

