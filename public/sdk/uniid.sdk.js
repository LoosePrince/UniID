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
    this.useDefaultStyle = config.useDefaultStyle !== false; // 默认开启
    this.targetHeight = 0;
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

  AuthSDK.prototype._clearToken = function () {
    this.token = null;
    this._setCookie("uniid_sdk_token", "", 0);
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
    // 不传递 parent_origin：embed 仅从 postMessage 的 event.origin 获取（浏览器生成，可信）
    iframe.src = this.authServer + "/embed?app_id=" + encodeURIComponent(this.appId);
    iframe.id = mount.id;
    iframe.className = mount.className;
    iframe.title = "UniID 授权窗口";
    iframe.style.display = "none";

    if (this.useDefaultStyle) {
      this._applyDefaultStyle(iframe);
    }

    mount.parentNode.replaceChild(iframe, mount);
    this.iframe = iframe;

    var self = this;
    iframe.onload = function () {
      if (self.iframe && self.iframe.contentWindow) {
        self.iframe.contentWindow.postMessage(
          { type: "uniid_init" },
          self.authServer
        );
      }
    };

    window.addEventListener("message", function (event) {
      if (!event.data || typeof event.data !== "object") return;

      // 处理高度自适应消息
      if (event.data.type === "uniid_resize" && event.data.height) {
        if (self.iframe && self.useDefaultStyle && window.innerWidth > 768) {
          // 增加一点缓冲高度
          self.targetHeight = event.data.height;
          self.iframe.style.height = self.targetHeight + "px";
        }
        return;
      }

      if (event.data.type === "uniid_login_success") {
        if (event.data.token) {
          self.token = event.data.token;
          self._setCookie(
            "uniid_sdk_token",
            event.data.token,
            event.data.expires_in || 3600
          );
        }
        if (self.loginResolver) {
          self.loginResolver({
            token: event.data.token,
            user: event.data.user || null
          });
          self.loginResolver = null;
        }
        if (self.iframe) {
          self.iframe.style.display = "none";
          if (self.useDefaultStyle) {
            self._hideOverlay();
          }
        }
      } else if (event.data.type === "uniid_login_cancel") {
        if (self.loginResolver) {
          self.loginResolver({
            token: null,
            user: null,
            cancelled: true
          });
          self.loginResolver = null;
        }
        if (self.iframe) {
          self.iframe.style.display = "none";
          if (self.useDefaultStyle) {
            self._hideOverlay();
          }
        }
      }
    });

    if (this.useDefaultStyle) {
      this._setupResizeHandler();
    }
  };

  AuthSDK.prototype._applyDefaultStyle = function (iframe) {
    iframe.style.position = "fixed";
    iframe.style.top = "50%";
    iframe.style.left = "50%";
    iframe.style.transform = "translate(-50%, -50%)";
    iframe.style.zIndex = "2147483647"; // 最高层级
    iframe.style.border = "none";
    iframe.style.borderRadius = "16px";
    iframe.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.5)";
    iframe.style.backgroundColor = "#020617"; // 匹配授权页背景色
    iframe.style.overflow = "hidden";
    this._updateIframeSize(iframe);
  };

  AuthSDK.prototype._updateIframeSize = function (iframe) {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var isLandscape = width > height;

    // 基础样式重置
    iframe.style.transition = "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.3s ease";

    if (width <= 768) {
      // 移动端或小屏幕：全贴合（全屏）
      iframe.style.width = "100vw";
      iframe.style.height = "100vh";
      iframe.style.borderRadius = "0";
      iframe.style.maxWidth = "100vw";
      iframe.style.maxHeight = "100vh";
    } else {
      // 桌面端：宽度固定，高度由 uniid_resize 动态调整，未收到前用默认值
      iframe.style.borderRadius = "16px";
      var h = (this.targetHeight && this.targetHeight > 0) ? this.targetHeight + "px" : "auto";
      if (isLandscape) {
        iframe.style.width = "800px";
        iframe.style.height = h;
      } else {
        iframe.style.width = "400px";
        iframe.style.height = h;
      }
      iframe.style.maxWidth = "90vw";
      iframe.style.maxHeight = "90vh";
    }
  };

  AuthSDK.prototype._setupResizeHandler = function () {
    var self = this;
    window.addEventListener("resize", function () {
      if (self.iframe && self.iframe.style.display !== "none") {
        self._updateIframeSize(self.iframe);
      }
    });
  };

  AuthSDK.prototype._showOverlay = function () {
    var overlay = document.getElementById("uniid-sdk-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "uniid-sdk-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      overlay.style.backdropFilter = "blur(4px)";
      overlay.style.zIndex = "2147483646";
      overlay.style.transition = "opacity 0.3s ease";
      overlay.style.display = "none";
      overlay.style.opacity = "0";
      document.body.appendChild(overlay);
    }
    overlay.style.display = "block";
    setTimeout(function () { overlay.style.opacity = "1"; }, 10);
  };

  AuthSDK.prototype._hideOverlay = function () {
    var overlay = document.getElementById("uniid-sdk-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(function () { overlay.style.display = "none"; }, 300);
    }
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
        if (self.useDefaultStyle) {
          self._showOverlay();
          self._updateIframeSize(self.iframe);
        }
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

  AuthSDK.prototype._fetch = function (method, path, body, options) {
    var self = this;
    options = options || {};
    if (!this.token) {
      this._restoreTokenFromCookie();
    }
    // 如果需要认证但没有 token，则报错
    if (options.requireAuth !== false && !this.token) {
      return Promise.reject(new Error("NO_TOKEN"));
    }
    var url = this.authServer + path;
    var headers = {};
    // 如果有 token，添加认证头
    if (this.token) {
      headers["Authorization"] = "Bearer " + this.token;
    }
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
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            // 遇到鉴权相关错误时，自动清理本地 token
            if (
              res.status === 401 &&
              data &&
              (data.error === "INVALID_TOKEN" ||
                data.error === "AUTHORIZATION_REVOKED" ||
                data.error === "AUTHORIZATION_EXPIRED" ||
                data.error === "AUTHORIZATION_NOT_FOUND")
            ) {
              self._clearToken();
            }
            var err = new Error("Request failed with status " + res.status);
            err.status = res.status;
            if (data && data.error) {
              err.code = data.error;
            }
            throw err;
          });
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
    // read 支持未登录访问（如果记录是公开的）
    return this._fetch("GET", "/api/data/record/" + encodeURIComponent(recordId), null, { requireAuth: false });
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
    // query 支持未登录访问（返回公开数据）
    return this._fetch("POST", "/api/data/query", params, { requireAuth: false });
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
          self._clearToken();
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

  // ==================== 便利方法 ====================

  /**
   * 检查用户是否已登录
   * @returns {boolean}
   */
  AuthSDK.prototype.isAuthenticated = function () {
    if (!this.token) {
      this._restoreTokenFromCookie();
    }
    if (!this.token) return false;
    // 本地校验 JWT 是否过期
    try {
      var parts = this.token.split('.');
      if (parts.length !== 3) {
        this._clearToken();
        return false;
      }
      var payload = JSON.parse(atob(parts[1]));
      if (payload.exp && typeof payload.exp === 'number') {
        var now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) {
          this._clearToken();
          return false;
        }
      }
    } catch (e) {
      this._clearToken();
      return false;
    }
    return !!this.token;
  };

  /**
   * 获取当前 token
   * @returns {string|null}
   */
  AuthSDK.prototype.getToken = function () {
    if (!this.token) {
      this._restoreTokenFromCookie();
    }
    return this.token;
  };

  /**
   * 获取当前用户信息（从 token 中解析）
   * @returns {object|null}
   */
  AuthSDK.prototype.getUser = function () {
    if (!this.token) {
      this._restoreTokenFromCookie();
    }
    if (!this.token) return null;
    try {
      var parts = this.token.split('.');
      if (parts.length !== 3) return null;
      var payload = JSON.parse(atob(parts[1]));
      // 如果本地发现 token 已过期，则视为未登录并清理
      if (payload.exp && typeof payload.exp === 'number') {
        var now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) {
          this._clearToken();
          return null;
        }
      }
      return {
        id: payload.sub,
        username: payload.username,
        role: payload.role
      };
    } catch (e) {
      return null;
    }
  };

  /**
   * 订阅认证状态变化
   * @param {function} callback - 回调函数，接收 { type: 'login'|'logout', user: object|null }
   * @returns {function} 取消订阅的函数
   */
  AuthSDK.prototype.onAuthChange = function (callback) {
    var self = this;
    var handler = function (event) {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'uniid_login_success') {
        callback({ type: 'login', user: event.data.user });
      } else if (event.data.type === 'uniid_login_cancel') {
        callback({ type: 'logout', user: null, reason: 'cancel' });
      }
    };
    window.addEventListener('message', handler);

    // 返回取消订阅函数
    return function () {
      window.removeEventListener('message', handler);
    };
  };

  /**
   * 查询指定类型的所有数据（简化版 query）
   * @param {string} type - 数据类型
   * @param {object} options - 可选参数 { filters, sort, limit, offset }
   * @returns {Promise}
   */
  AuthSDK.prototype.findAll = function (type, options) {
    options = options || {};
    return this.query({
      data_type: type,
      filters: options.filters,
      sort: options.sort,
      limit: options.limit,
      offset: options.offset
    });
  };

  /**
   * 根据 ID 查询单条记录（简化版 read）
   * @param {string} recordId - 记录 ID
   * @returns {Promise}
   */
  AuthSDK.prototype.findById = function (recordId) {
    return this.read(recordId);
  };

  /**
   * 更新记录的部分字段（简化版 update）
   * @param {string} recordId - 记录 ID
   * @param {object} data - 要更新的数据
   * @returns {Promise}
   */
  AuthSDK.prototype.patch = function (recordId, data) {
    return this.update(recordId, data);
  };

  /**
   * 批量创建记录
   * @param {string} type - 数据类型
   * @param {array} items - 数据数组
   * @param {object} permissions - 权限配置
   * @returns {Promise}
   */
  AuthSDK.prototype.createMany = function (type, items, permissions) {
    var self = this;
    var promises = items.map(function (item) {
      return self.create(type, item, permissions);
    });
    return Promise.all(promises);
  };

  /**
   * 批量删除记录
   * @param {array} recordIds - 记录 ID 数组
   * @returns {Promise}
   */
  AuthSDK.prototype.deleteMany = function (recordIds) {
    var self = this;
    var promises = recordIds.map(function (id) {
      return self.delete(id);
    });
    return Promise.all(promises);
  };

  /**
   * 切换布尔值字段（如点赞）
   * @param {string} recordId - 记录 ID
   * @param {string} fieldPath - 字段路径，如 "likes.user123"
   * @param {boolean} value - 要设置的值
   * @returns {Promise}
   */
  AuthSDK.prototype.toggleField = function (recordId, fieldPath, value) {
    var data = {};
    var keys = fieldPath.split('.');
    var current = data;
    for (var i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return this.update(recordId, data);
  };

  // ==================== 通用工具类 ====================

  /**
   * 权限配置生成器 - 自动生成常见的权限配置
   */
  AuthSDK.Permissions = {
    /**
     * 完全私有（仅所有者可见）
     * @returns {object}
     */
    private: function () {
      return {
        default: {
          read: ["$owner"],
          write: ["$owner"],
          delete: ["$owner"]
        }
      };
    },

    /**
     * 完全公开（所有人可见，仅所有者可修改）
     * @returns {object}
     */
    public: function () {
      return {
        default: {
          read: ["$public"],
          write: ["$owner"],
          delete: ["$owner"]
        }
      };
    },

    /**
     * 应用内公开（登录用户可见）
     * @returns {object}
     */
    appOnly: function () {
      return {
        default: {
          read: ["$app_user"],
          write: ["$owner"],
          delete: ["$owner"]
        }
      };
    },

    /**
     * 自定义权限
     * @param {object} options - 配置选项
     * @param {array} options.read - 读取权限
     * @param {array} options.write - 写入权限
     * @param {array} options.delete - 删除权限
     * @returns {object}
     */
    custom: function (options) {
      options = options || {};
      return {
        default: {
          read: options.read || ["$owner"],
          write: options.write || ["$owner"],
          delete: options.delete || ["$owner"]
        }
      };
    },

    /**
     * 带字段级权限的配置
     * @param {object} fieldPermissions - 字段权限映射 { fieldName: { read: [], write: [] } }
     * @param {object} defaultPermissions - 默认权限
     * @returns {object}
     */
    withFields: function (fieldPermissions, defaultPermissions) {
      return {
        default: defaultPermissions || this.public().default,
        fields: fieldPermissions || {}
      };
    },

    /**
     * 嵌套对象权限（支持通配符）
     * @param {object} options - 配置选项
     * @param {string} options.pathPattern - 路径模式，如 "settings.*.value"
     * @param {object} options.permissions - 权限配置 { read: [], write: [], delete: [] }
     * @returns {object}
     */
    nested: function (options) {
      options = options || {};
      var pattern = options.pathPattern || "*";
      var perms = options.permissions || { read: ["$owner"], write: ["$owner"] };
      var fields = {};
      fields[pattern] = perms;
      return {
        default: { read: ["$owner"], write: ["$owner"], delete: ["$owner"] },
        fields: fields
      };
    }
  };

  /**
   * 数据处理工具
   */
  AuthSDK.Utils = {
    /**
     * 深合并对象
     * @param {object} target - 目标对象
     * @param {object} source - 源对象
     * @returns {object}
     */
    deepMerge: function (target, source) {
      var result = {};
      for (var key in target) {
        if (target.hasOwnProperty(key)) {
          result[key] = target[key];
        }
      }
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            result[key] = this.deepMerge(result[key] || {}, source[key]);
          } else {
            result[key] = source[key];
          }
        }
      }
      return result;
    },

    /**
     * 根据路径获取嵌套对象值
     * @param {object} obj - 对象
     * @param {string} path - 路径，如 "comments.user123"
     * @returns {any}
     */
    getByPath: function (obj, path) {
      var keys = path.split('.');
      var current = obj;
      for (var i = 0; i < keys.length; i++) {
        if (current === null || current === undefined) return undefined;
        current = current[keys[i]];
      }
      return current;
    },

    /**
     * 根据路径设置嵌套对象值
     * @param {object} obj - 对象
     * @param {string} path - 路径
     * @param {any} value - 值
     */
    setByPath: function (obj, path, value) {
      var keys = path.split('.');
      var current = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    },

    /**
     * 生成唯一 ID
     * @returns {string}
     */
    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * 格式化时间戳
     * @param {number} timestamp - 时间戳（秒）
     * @returns {string}
     */
    formatTime: function (timestamp) {
      var date = new Date(timestamp * 1000);
      var now = new Date();
      var diff = Math.floor((now - date) / 1000);

      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
      if (diff < 604800) return Math.floor(diff / 86400) + '天前';

      return date.toLocaleDateString();
    },

    /**
     * 转义 HTML 特殊字符
     * @param {string} text
     * @returns {string}
     */
    escapeHtml: function (text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  /**
   * 身份和角色管理
   */
  AuthSDK.Identity = {
    /**
     * 检查当前用户是否有特定角色
     * @param {string} role - 角色名称
     * @returns {boolean}
     */
    hasRole: function (sdk, role) {
      var user = sdk.getUser();
      return user && user.role === role;
    },

    /**
     * 检查当前用户是否是管理员
     * @param {AuthSDK} sdk
     * @returns {boolean}
     */
    isAdmin: function (sdk) {
      return this.hasRole(sdk, 'admin');
    },

    /**
     * 检查当前用户是否是记录所有者
     * @param {AuthSDK} sdk
     * @param {object} record - 记录对象
     * @returns {boolean}
     */
    isOwner: function (sdk, record) {
      var user = sdk.getUser();
      return user && record && record.owner_id === user.id;
    },

    /**
     * 获取当前用户 ID
     * @param {AuthSDK} sdk
     * @returns {string|null}
     */
    getUserId: function (sdk) {
      var user = sdk.getUser();
      return user ? user.id : null;
    }
  };

  /**
   * 错误处理和重试
   */
  AuthSDK.withRetry = function (fn, options) {
    options = options || {};
    var maxRetries = options.maxRetries || 3;
    var delay = options.delay || 1000;
    var backoff = options.backoff || 2;

    return function () {
      var args = arguments;
      var self = this;
      var attempt = 0;

      function tryExecute() {
        attempt++;
        return fn.apply(self, args).catch(function (err) {
          if (attempt >= maxRetries) throw err;

          // 只在网络错误或 5xx 错误时重试
          if (err.status >= 500 || err.message === 'Network Error' || err.message === 'TIMEOUT') {
            return new Promise(function (resolve) {
              setTimeout(resolve, delay * Math.pow(backoff, attempt - 1));
            }).then(tryExecute);
          }
          throw err;
        });
      }

      return tryExecute();
    };
  };

  window.AuthSDK = AuthSDK;
})();

