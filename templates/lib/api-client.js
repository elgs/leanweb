// Please don't modify this file. Create one outside of the lib directory with
// your project speicific configurations. Files in the lib directory is subject
// to overwrite on Leanweb upgrade.

class APIClient {
  constructor(baesUrl, sendToken = false, defaultHeaders = {}) {
    this.baesUrl = baesUrl;
    this.sendToken = sendToken;
    this.defaultHeaders = defaultHeaders;
  }

  async _fetch(method, url = '', data = {}, headers = {}) {
    if (!url.toLowerCase().startsWith('https://') && !url.toLowerCase().startsWith('http://')) {
      url = this.baesUrl + url;
    }

    if (method === 'GET' && data && typeof data === 'object') {
      // encode data and append to url
      const queryString = paramsToQueryString(data);
      data = null;
      if (url.endsWith('?')) {
        url += queryString;
      } else if (url.indexOf('?') >= 0) {
        url += ('&' + queryString);
      } else {
        url += ('?' + queryString);
      }
    }

    if (this.sendToken) {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers['authorization'] = token;
      } else {
        return null;
      }
    }
    const response = await fetch(url, {
      method,
      headers: { ...this.defaultHeaders, ...headers },
      body: data ? JSON.stringify(data) : null,
    });
    return response.json();
  }

  post(url, data, headers) { return this._fetch('POST', url, data, headers); }
  get(url, data, headers) { return this._fetch('GET', url, data, headers); }
  patch(url, data, headers) { return this._fetch('PATCH', url, data, headers); }
  delete(url, data, headers) { return this._fetch('DELETE', url, data, headers); }
  put(url, data, headers) { return this._fetch('PUT', url, data, headers); }
  options(url, data, headers) { return this._fetch('OPTIONS', url, data, headers); }
}

const paramsToQueryString = (params) => {
  return Object.keys(params).map(k => {
    const v = params[k];
    if (Array.isArray(v)) {
      return v.reduce((vacc, vcurr) => {
        return `${vacc}${k}=${encodeURIComponent(vcurr)}&`;
      }, '');
    } else {
      return `${k}=${encodeURIComponent(v)}&`;
    }
  }).reduce((acc, curr) => acc + curr, '').slice(0, -1);
};

// const apiUrl = 'http://localhost:1234';
// const anotherApiUrl = 'http://127.0.0.1:4321';

// export const api = new APIClient(apiUrl, true);
// export const http = new APIClient(apiUrl);

// export const anotherApi = new APIClient(anotherApiUrl, true);
// export const anotherHttp = new APIClient(anotherApiUrl);