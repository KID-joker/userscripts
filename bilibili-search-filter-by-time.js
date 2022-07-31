// ==UserScript==
// @name         Bilibili Search Filter By Time
// @namespace    https://github.com/KID-joker/userscript
// @version      1.0.1
// @updateURL    https://github.com/KID-joker/userscript/blob/main/bilibili-search-filter-by-time.js
// @downloadURL  https://github.com/KID-joker/userscript/blob/main/bilibili-search-filter-by-time.js
// @supportURL   https://github.com/KID-joker/userscript/issues
// @description  add time filter to bilibili search results
// @author       KID-joker
// @match        https://search.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico?v=1
// @resource css https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css
// @require      https://cdn.jsdelivr.net/npm/flatpickr
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    // 设置样式
    let css = `
        @media (max-width: 1099.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1439.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1699.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1919.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 2199.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
    `
    GM_addStyle(css)
    GM_addStyle(GM_getResourceText('css'));

    // 获取过滤日期
    function getQueryObject(url) {
        url = url == null ? window.location.href : url
        const search = url.substring(url.lastIndexOf('?') + 1)
        const obj = {}
        const reg = /([^?&=]+)=([^?&=]*)/g
        search.replace(reg, (rs, $1, $2) => {
            const name = decodeURIComponent($1)
            let val = decodeURIComponent($2)
            val = String(val)
            obj[name] = val
            return rs
        })
        return obj
    }
    let queryObj = getQueryObject();
    let date = queryObj.date || 'none';
    let dateRange = queryObj.date_range;
    if(date !== 'none') {
        dateRange = dateRange.split('_');
    }

    // 返回json结果
    let responseJson = null;
    // 过滤的结果
    let result = [];
    // 日期过滤的页码
    let actualPage = 1;
    // b站对应页面
    let requestPage = 1;
    // 数量
    let pageSize = 0;
    // 没有更多数据
    let finished = false;
    // 最大页码
    let maxPage = 1;
    // 自定义日期选择弹窗
    let fp = null;

    // 重写fetch，拦截fetch请求
    const originFetch = fetch;
    unsafeWindow.fetch = async function(url, options) {
        // 只针对视频搜索接口
        let params = getQueryObject(url);
        if(url.indexOf('x/web-interface/search/type') > -1 && params.search_type === 'video' && date !== 'none') {
            actualPage = params.page;
            pageSize = params.page_size;
            if(result.length < actualPage * pageSize) {
                await requestData(url, options);
            }
            let reponseResult = result.slice((actualPage - 1) * pageSize, actualPage * pageSize);
            let response = new Response();
            response.json = function() {
                return new Promise(resolve => {
                    responseJson.data.page = +actualPage;
                    responseJson.data.result = reponseResult;
                    resolve(responseJson);
                })
            }
            setTimeout(() => {
                changePagenationBtn();
            }, 0);
            return response;
        } else {
            return originFetch(url, options);
        }
    }

    // 获取vue实例、vue-router实例
    let app = null, router = null, route = null;
    document.addEventListener('DOMContentLoaded', function() {
        app = document.querySelector('#i_cecream').__vue_app__;
        router = app.config.globalProperties.$router;
        route = app.config.globalProperties.$route;
        if(route.name === 'video') {
            insertComponent();
        }
        router.afterEach(route => {
            if(route.name === 'video') {
                insertComponent();
            }
        })

        // 重写replace方法，拦截跳转，更新route，初始化数据
        const routerReplace = router.replace;
        router.replace = function(toRoute) {
            // 筛选条件改变
            if(!toRoute.query.date || toRoute.query.date === 'none' || !toRoute.query.page) {
                route = toRoute;
                result = [];
                actualPage = 1;
                requestPage = 1;
                pageSize = 0;
                finished = false;
                return routerReplace.call(this, toRoute);
            }
        }
    })

    // 插入日期过滤组件
    function insertComponent() {
        if(document.querySelector('#date-search-confitions')) {
            return;
        }
        let element = document.createElement('div');
        element.id = 'date-search-confitions';
        element.className = 'search-condition-row';
        element.addEventListener('click', clickDateCondition);
        let fragment = document.createDocumentFragment();
        let list = [{
            name: 'none',
            title: '时间不限'
        }, {
            name: 'day',
            title: '过去1天内'
        }, {
            name: 'week',
            title: '过去1周内'
        }, {
            name: 'month',
            title: '过去1月内'
        }, {
            name: 'year',
            title: '过去1年内'
        }, {
            name: 'custom',
            title: '自定日期范围'
        }]
        list.forEach(function(ele) {
            let button = document.createElement('button');
            button.textContent = ele.title;
            button.className = 'vui_button vui_button--tab mt_sm mr_sm';
            button.dataset.datecondition = ele.name;
            if(ele.name === date) {
                button.className += ' vui_button--active';
            }
            fragment.appendChild(button);
        });
        element.appendChild(fragment);
        document.querySelector('.more-conditions').appendChild(element);
    }

    // 日期过滤点击事件
    function clickDateCondition(evt) {
        let datecondition = evt.target.dataset.datecondition;
        if(datecondition === 'none') {
            // 时间不限
            let { date, date_range, ...query } = route.query;
            router.replace({
                'name': 'video',
                query
            });
            setTimeout(() => {
                router.go(0);
            }, 0);
        } else if(datecondition === 'custom') {
            // 自定义日期范围，弹出日期选择弹窗
            if(!fp) {
                fp = evt.target.flatpickr({
                    clickOpens: false,
                    maxDate: 'today',
                    mode: 'range',
                    onChange: function(selectedDates) {
                        if(selectedDates.length == 2) {
                            let startTime = +selectedDates[0];
                            let endTime = +selectedDates[1];
                            if(startTime == endTime) {
                                endTime += 86400000;
                            }
                            endTime = Math.min(Date.now(), endTime);
                            filterByDate(datecondition, startTime, endTime);
                        }
                    }
                });
            }
            fp.open();
        } else if(datecondition) {
            // 固定日期范围选择
            let endTime = Date.now();
            let timeMap = {
                'day': 86400000,
                'week': 604800000,
                'month': 2592000000,
                'year': 31536000000
            }
            filterByDate(datecondition, endTime - timeMap[datecondition], endTime);
        }
    }

    function filterByDate(datecondition, startTime, endTime) {
        let { page, o, ...query } = route.query;
        query.date = datecondition;
        query.date_range = `${Math.floor(startTime / 1000)}_${Math.floor(endTime / 1000)}`;
        router.replace({
            name: 'video',
            query
        });
        setTimeout(() => {
            router.go(0);
        }, 0);
    }

    // 隐藏分页按钮
    function changePagenationBtn() {
        if(date !== 'none') {
            let pagenationBtnList = document.querySelectorAll('.vui_pagenation--btn-num');
            if(pagenationBtnList.length > 0) {
                for(let btn of pagenationBtnList) {
                    btn.remove();
                }
            }
            let pagenationText = document.querySelector('.vui_pagenation--extend');
            if(pagenationText) {
                pagenationText.remove();
            }

            let pagenationParent = document.querySelector('.vui_pagenation--btns');
            if(pagenationParent) {
                let nextPagenation = pagenationParent.lastChild;
                if(finished && actualPage === maxPage) {
                    nextPagenation.className += ' vui_button--disabled';
                    nextPagenation.setAttribute('disabled', 'disabled')
                } else {
                    nextPagenation.className = nextPagenation.className.replace(' vui_button--disabled', '');
                    nextPagenation.removeAttribute('disabled');
                }
            }
        }
    }

    // 请求数据保存
    async function requestData(url, options) {
        while(true) {
            url = url.replace(/page=[0-9]+/, `page=${requestPage}`);
            // 应该是浏览的偏移量，必须跟页码数量保持一致，不然会有重复数据
            url = url.replace(/dynamic_offset=[0-9]+/, `dynamic_offset=${(requestPage - 1) * pageSize}`);
            let _responseJson = await originFetch(url, options).then(response => {
                return response.json();
            });
            if(_responseJson.data && _responseJson.data.result) {
                if(_responseJson.data.result.length < pageSize) {
                    finished = true;
                    maxPage = actualPage;
                }
                responseJson = _responseJson;
                let list = responseJson.data.result.filter(ele => ele.pubdate >= dateRange[0] && ele.pubdate <= dateRange[1]);
                result = result.concat(list);
            } else {
                // 没有更多数据了
                finished = true;
                maxPage = actualPage;
            }
            requestPage++;
            if(finished || result.length >= actualPage * pageSize) {
                return;
            } else {
                let time = Math.round(Math.random() * 200) + 300;
                await delay(time);
            }
        }
    }

    // 防止请求频繁，被封ip
    function delay(n){
        return new Promise(function(resolve){
            setTimeout(resolve, n);
        });
    }
})();