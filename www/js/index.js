document.addEventListener('deviceready', onDeviceReady, false);

var allRecords = null; // API取得後に格納

function setStatus(msg) {
    var el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function callApi(successFn, errorFn) {
    var url = 'http://toyohide.work/BrainLog/api/getToushiShintakuDealHistory';

    // Android: cordova-plugin-advanced-http でCORSを回避
    if (window.cordova && cordova.plugin && cordova.plugin.http) {
        cordova.plugin.http.setDataSerializer('json');
        cordova.plugin.http.post(url, {}, {}, function(response) {
            successFn(JSON.parse(response.data));
        }, function(response) {
            errorFn(new Error(response.error));
        });
    } else {
        // browser プラットフォーム用
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
            .then(function(r) { return r.json(); })
            .then(successFn)
            .catch(errorFn);
    }
}

function onDeviceReady() {
    setStatus('deviceready OK → API呼び出し中...');

    callApi(function(json) {
            allRecords = json.data.filter(function(item) {
                return item.deal_kind !== '償還';
            });

            var groups = {};
            var oldestDate = {};

            allRecords.forEach(function(item) {
                var id = item.relational_id;
                if (!groups[id]) {
                    groups[id] = {
                        relational_id: id,
                        fund_name:     item.fund_name,
                        account_kind:  item.account_kind,
                        course:        item.course,
                        pay_methods:   [],
                        records:       []
                    };
                }
                var exists = groups[id].pay_methods.some(function(p) { return p.method === item.pay_method; });
                if (!exists && item.pay_method && item.pay_method.trim() !== '') {
                    groups[id].pay_methods.push({ method: item.pay_method, price: item.order_price });
                }
                groups[id].records.push(item);
                var fn = item.fund_name;
                if (!oldestDate[fn] || item.order_date < oldestDate[fn]) {
                    oldestDate[fn] = item.order_date;
                }
            });

            var accountKindColorMap = {
                '特定':         'account-tokutei',
                '一般':         'account-ippan',
                'NISA':         'account-nisa',
                'つみたてNISA': 'account-tsumitate'
            };

            var list = document.getElementById('list');
            Object.values(groups).forEach(function(group) {
                var accountCls = accountKindColorMap[group.account_kind] || 'account-other';
                var raw = oldestDate[group.fund_name] || '';
                var yearMonth = raw ? raw.slice(0, 7) : '';

                var li = document.createElement('li');
                var avatar = document.createElement('div');
                avatar.className = 'avatar';
                avatar.textContent = group.relational_id;

                var info = document.createElement('div');
                info.className = 'info';
                [
                    { text: group.fund_name,    cls: 'info-primary' },
                    { text: group.account_kind, cls: 'info-secondary ' + accountCls },
                    { text: group.pay_methods.map(function(p) { return p.method + '（' + Number(p.price).toLocaleString() + '）'; }).join(' / '), cls: 'info-tertiary' },
                    { text: group.course,       cls: 'info-sub' },
                    { text: yearMonth,          cls: 'info-sub' }
                ].forEach(function(row) {
                    var p = document.createElement('p');
                    p.className = row.cls;
                    p.textContent = row.text;
                    info.appendChild(p);
                });

                li.appendChild(avatar);
                li.appendChild(info);
                li.addEventListener('click', function() { openDialog(group, accountCls); });
                list.appendChild(li);
            });

            // リストダイアログ外タップで閉じる
            document.getElementById('dialog-overlay').addEventListener('click', function(e) {
                if (e.target === this) { this.classList.remove('open'); }
            });
            // グラフダイアログ外タップでグラフだけ閉じる
            document.getElementById('graph-overlay').addEventListener('click', function(e) {
                if (e.target === this) { this.classList.remove('open'); }
            });
            // ペイダイアログ
            document.getElementById('pay-btn').addEventListener('click', function() {
                openPayDialog();
            });
            document.getElementById('pay-overlay').addEventListener('click', function(e) {
                if (e.target === this) { this.classList.remove('open'); }
            });

            setStatus('');

    }, function(error) {
        setStatus('エラー: ' + error.message);
        console.error('API error:', error);
    });
}

function openPayDialog() {
    // 月ごとに集計
    var monthMap = {};
    var monthKeys = [];

    allRecords.filter(function(item) {
        return item.deal_kind !== '再投資';
    }).forEach(function(item) {
        var key = item.order_date.slice(0, 7); // YYYY-MM
        if (!monthMap[key]) {
            monthMap[key] = { total: 0, methods: {} };
            monthKeys.push(key);
        }
        monthMap[key].total += Number(item.pay_price);
        var method = (item.pay_method || '').trim() || '不明';
        if (!monthMap[key].methods[method]) {
            monthMap[key].methods[method] = 0;
        }
        monthMap[key].methods[method] += Number(item.pay_price);
    });

    // 昇順（古い月が上）
    monthKeys.sort();

    var payList = document.getElementById('pay-list');
    payList.innerHTML = '';

    monthKeys.forEach(function(key) {
        var data = monthMap[key];
        var li = document.createElement('li');

        var monthEl = document.createElement('div');
        monthEl.className = 'pay-month';
        monthEl.textContent = key;

        var totalEl = document.createElement('div');
        totalEl.className = 'pay-total';
        totalEl.textContent = data.total.toLocaleString();

        var methodsEl = document.createElement('div');
        methodsEl.className = 'pay-methods';

        var methodOrder = ['クレジットカード決済', '証券口座', '楽天キャッシュ'];
        var sortedMethods = Object.keys(data.methods).sort(function(a, b) {
            var ai = methodOrder.indexOf(a);
            var bi = methodOrder.indexOf(b);
            if (ai === -1) ai = methodOrder.length;
            if (bi === -1) bi = methodOrder.length;
            return ai - bi;
        });

        sortedMethods.forEach(function(method) {
            var row = document.createElement('div');
            row.className = 'pay-method-row';

            var nameEl = document.createElement('span');
            nameEl.className = 'pay-method-name';
            nameEl.textContent = method.replace('決済', '');

            var priceEl = document.createElement('span');
            priceEl.className = 'pay-method-price';
            priceEl.textContent = data.methods[method].toLocaleString();

            row.appendChild(nameEl);
            row.appendChild(priceEl);
            methodsEl.appendChild(row);
        });

        var avatarEl = document.createElement('div');
        avatarEl.className = 'pay-method-avatar';
        (function(k) {
            avatarEl.addEventListener('click', function(e) {
                e.stopPropagation();
                openPayDetailDialog(k);
            });
        })(key);

        li.appendChild(avatarEl);
        li.appendChild(monthEl);
        li.appendChild(totalEl);
        li.appendChild(methodsEl);
        payList.appendChild(li);
    });

    document.getElementById('pay-overlay').classList.add('open');

    var payList = document.getElementById('pay-list');
    document.getElementById('pay-scroll-top').onclick = function() {
        payList.scrollTop = 0;
    };
    document.getElementById('pay-scroll-bottom').onclick = function() {
        payList.scrollTop = payList.scrollHeight;
    };
}

function openPayDetailDialog(monthKey) {
    var header = document.getElementById('pay-detail-header');
    header.innerHTML = '';

    var detailList = document.getElementById('pay-detail-list');
    detailList.innerHTML = '';

    var records = allRecords.filter(function(item) {
        return item.order_date.slice(0, 7) === monthKey;
    }).sort(function(a, b) {
        return a.order_date.localeCompare(b.order_date);
    });

    var total = records.reduce(function(sum, r) { return sum + Number(r.pay_price); }, 0);

    var titleEl = document.createElement('span');
    titleEl.className = 'header-title';
    titleEl.textContent = monthKey + ' の注文';

    var totalEl = document.createElement('span');
    totalEl.className = 'header-total';
    totalEl.textContent = total.toLocaleString();

    header.appendChild(titleEl);
    header.appendChild(totalEl);

    records.forEach(function(rec) {
        var li = document.createElement('li');

        // 左：日付CircleAvatar
        var dayEl = document.createElement('div');
        dayEl.className = 'pay-detail-day';
        dayEl.textContent = rec.order_date.slice(8, 10); // DD

        // 右：角丸カード
        var card = document.createElement('div');
        card.className = 'pay-detail-card';

        var idEl = document.createElement('div');
        idEl.className = 'pay-detail-relational-id';
        idEl.textContent = rec.relational_id;

        var fundEl = document.createElement('div');
        fundEl.className = 'pay-detail-fund-name';
        fundEl.textContent = rec.fund_name;

        [
            rec.account_kind,
            rec.deal_kind,
            Number(rec.order_price).toLocaleString() + ' 円',
            rec.pay_method,
            Number(rec.suuryou).toLocaleString() + ' 口'
        ].forEach(function(value) {
            var row = document.createElement('div');
            row.className = 'pay-detail-row';

            var valueEl = document.createElement('span');
            valueEl.className = 'pay-detail-value';
            valueEl.textContent = value;

            row.appendChild(valueEl);
            card.appendChild(row);
        });

        card.insertBefore(fundEl, card.firstChild);
        card.insertBefore(idEl, card.firstChild);

        li.appendChild(dayEl);
        li.appendChild(card);
        detailList.appendChild(li);
    });

    document.getElementById('pay-detail-overlay').classList.add('open');
    setTimeout(function() {
        detailList.scrollTop = 0;
    }, 0);

    document.getElementById('pay-detail-overlay').onclick = function(e) {
        if (e.target === this) { this.classList.remove('open'); }
    };
}

function openDialog(group, accountCls) {
    var header     = document.getElementById('dialog-header');
    var dialogList = document.getElementById('dialog-list');

    header.innerHTML = '';

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = group.relational_id;

    var headerInfo = document.createElement('div');
    headerInfo.className = 'info';
    [
        { text: group.fund_name,    cls: 'info-primary' },
        { text: group.account_kind, cls: 'info-secondary ' + accountCls },
        { text: group.course,       cls: 'info-sub' }
    ].forEach(function(row) {
        var p = document.createElement('p');
        p.className = row.cls;
        p.textContent = row.text;
        headerInfo.appendChild(p);
    });

    var graphBtn = document.createElement('div');
    graphBtn.className = 'avatar graph-btn';
    graphBtn.textContent = '📈';
    graphBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openGraphDialog(group, accountCls);
    });

    header.appendChild(avatar);
    header.appendChild(headerInfo);
    header.appendChild(graphBtn);

    dialogList.innerHTML = '';
    group.records.forEach(function(rec) {
        var li   = document.createElement('li');
        var grid = document.createElement('div');
        grid.className = 'record-grid';

        [
            { label: '注文日',   value: rec.order_date },
            { label: '注文金額', value: Number(rec.order_price).toLocaleString() + ' 円' },
            { label: '数量',     value: Number(rec.suuryou).toLocaleString() + ' 口' },
            { label: '基準価格', value: Number(rec.kijun_price).toLocaleString() + ' 円' },
            { label: '受渡日',   value: rec.receive_date },
            { label: '支払金額', value: Number(rec.pay_price).toLocaleString() + ' 円' },
            { label: '', value: '', empty: true },
            { label: '', value: '', empty: true }
        ].forEach(function(cell) {
            var div   = document.createElement('div');
            div.className = 'record-cell' + (cell.empty ? ' empty' : '');
            var label = document.createElement('span');
            label.className = 'record-label';
            label.textContent = cell.label;
            var val   = document.createElement('span');
            val.className = 'record-value';
            val.textContent = cell.value;
            div.appendChild(label);
            div.appendChild(val);
            grid.appendChild(div);
        });

        var ym = (rec.order_date || '').slice(0, 7); // YYYY-MM
        var dateAvatar = document.createElement('div');
        dateAvatar.className = 'record-date-avatar';
        var yearEl = document.createElement('span');
        yearEl.className = 'record-date-year';
        yearEl.textContent = ym.slice(0, 4);
        var monthEl = document.createElement('span');
        monthEl.className = 'record-date-month';
        monthEl.textContent = ym.slice(5, 7);
        dateAvatar.appendChild(yearEl);
        dateAvatar.appendChild(monthEl);

        li.appendChild(grid);
        li.appendChild(dateAvatar);
        dialogList.appendChild(li);
    });

    document.getElementById('dialog-overlay').classList.add('open');
    setTimeout(function() {
        document.getElementById('dialog-list').scrollTop = 0;
    }, 0);
}

function openGraphDialog(group, accountCls) {
    var graphHeader = document.getElementById('graph-header');
    graphHeader.innerHTML = '';

    // ヘッダー：リストダイアログと同じ情報
    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = group.relational_id;

    var headerInfo = document.createElement('div');
    headerInfo.className = 'info';
    [
        { text: group.fund_name,    cls: 'info-primary' },
        { text: group.account_kind, cls: 'info-secondary ' + accountCls },
        { text: group.course,       cls: 'info-sub' }
    ].forEach(function(row) {
        var p = document.createElement('p');
        p.className = row.cls;
        p.textContent = row.text;
        headerInfo.appendChild(p);
    });

    graphHeader.appendChild(avatar);
    graphHeader.appendChild(headerInfo);

    drawChart(group.records);
    drawMiniChart(group.records, document.getElementById('mini-chart'));

    document.getElementById('graph-overlay').classList.add('open');
    setTimeout(function() {
        document.getElementById('graph-scroll').scrollLeft = 0;
    }, 0);
}

// レコードを月ごとに集計
function groupByMonth(records) {
    var sorted = records.slice().sort(function(a, b) {
        return a.order_date.localeCompare(b.order_date);
    });

    var monthMap = {};
    var monthKeys = [];

    sorted.forEach(function(r) {
        var key = r.order_date.slice(0, 7); // YYYY-MM
        if (!monthMap[key]) {
            monthMap[key] = { suuryou: 0, order_price: 0, pay_price: 0, kijun_sum: 0, count: 0 };
            monthKeys.push(key);
        }
        monthMap[key].suuryou      += Number(r.suuryou);
        monthMap[key].order_price  += Number(r.order_price);
        monthMap[key].pay_price    += Number(r.pay_price);
        monthMap[key].kijun_sum    += Number(r.kijun_price);
        monthMap[key].count++;
    });

    return monthKeys.map(function(key) {
        var m = monthMap[key];
        return {
            order_date:  key,                               // YYYY-MM
            suuryou:     m.suuryou,
            order_price: m.order_price,
            pay_price:   m.pay_price,
            kijun_price: Math.round(m.kijun_sum / m.count) // 月平均
        };
    });
}

// Y軸目盛りをキリの良い数値に丸める
function calcNiceTicks(dataMin, dataMax, count) {
    // flat data（全値同一）の場合は前後10%の範囲を作る
    if (dataMin === dataMax) {
        var delta = dataMax * 0.1 || 1;
        dataMin = dataMax - delta;
        dataMax = dataMax + delta;
    }
    var range = dataMax - dataMin;
    var rough = range / count;
    var mag   = Math.pow(10, Math.floor(Math.log10(rough)));
    var f     = rough / mag;
    var step  = f < 1.5 ? mag : f < 3 ? 2 * mag : f < 7 ? 5 * mag : 10 * mag;
    var nMin  = Math.floor(dataMin / step) * step;
    var nMax  = Math.ceil(dataMax  / step) * step;
    // nMin === nMax になってしまう場合のフォールバック
    if (nMin === nMax) { nMin -= step; nMax += step; }
    var ticks = [];
    for (var v = nMin; v <= nMax + step * 0.01; v += step) {
        ticks.push(Math.round(v));
    }
    return { ticks: ticks, min: nMin, max: nMax };
}

function drawChart(records) {
    var sorted = groupByMonth(records);

    var n       = sorted.length;
    var mLeft   = 80;
    var mRight  = 80;
    var mTop    = 52;
    var mBottom = 104;
    var spacing = 120;
    var chartH  = 240;
    var svgW    = mLeft + n * spacing + mRight;
    var svgH    = mTop + chartH + mBottom;

    var suuryouVals = sorted.map(function(r) { return Number(r.suuryou); });
    var kijunVals   = sorted.map(function(r) { return Number(r.kijun_price); });
    var orderVals  = sorted.map(function(r) { return Number(r.order_price); });
    var payVals    = sorted.map(function(r) { return Number(r.pay_price); });
    var orderPayAll = orderVals.concat(payVals);

    var sT = calcNiceTicks(Math.min.apply(null, suuryouVals), Math.max.apply(null, suuryouVals), 5);
    var kT = calcNiceTicks(Math.min.apply(null, kijunVals),   Math.max.apply(null, kijunVals),   5);
    var oT = calcNiceTicks(Math.min.apply(null, orderPayAll), Math.max.apply(null, orderPayAll), 5);

    function scaleY(v, min, max) {
        return mTop + chartH - ((v - min) / (max - min)) * chartH;
    }
    function xPos(i) {
        return mLeft + i * spacing + spacing / 2;
    }

    var NS  = 'http://www.w3.org/2000/svg';
    var svg = document.getElementById('chart');
    svg.setAttribute('width',   svgW);
    svg.setAttribute('height',  svgH);
    svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
    svg.innerHTML = '';

    function el(tag, attrs, text) {
        var e = document.createElementNS(NS, tag);
        Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
        if (text !== undefined) e.textContent = text;
        return e;
    }

    // 凡例
    [
        { label: '数量',     color: '#64b5f6', x: mLeft },
        { label: '基準価格', color: '#f06292', x: mLeft + 110 },
        { label: '注文金額', color: '#a5d6a7', x: mLeft + 220 }
    ].forEach(function(lg) {
        svg.appendChild(el('line',   { x1: lg.x, y1: 18, x2: lg.x + 20, y2: 18, stroke: lg.color, 'stroke-width': '2' }));
        svg.appendChild(el('circle', { cx: lg.x + 10, cy: 18, r: 4, fill: lg.color }));
        svg.appendChild(el('text',   { x: lg.x + 26, y: 24, fill: lg.color, 'font-size': '13' }, lg.label));
    });

    // グリッド + 左Y軸
    sT.ticks.forEach(function(tv) {
        var gy = scaleY(tv, sT.min, sT.max);
        svg.appendChild(el('line', { x1: mLeft, y1: gy, x2: mLeft + n * spacing, y2: gy, stroke: '#333333', 'stroke-width': '1', 'stroke-dasharray': '4,3' }));
        svg.appendChild(el('text', { x: mLeft - 6, y: gy + 4, 'text-anchor': 'end', fill: '#64b5f6', 'font-size': '12' }, tv.toLocaleString()));
    });

    // 右Y軸
    kT.ticks.forEach(function(tv) {
        var gy = scaleY(tv, kT.min, kT.max);
        svg.appendChild(el('text', { x: mLeft + n * spacing + 6, y: gy + 4, 'text-anchor': 'start', fill: '#f06292', 'font-size': '12' }, tv.toLocaleString()));
    });

    // 軸線
    svg.appendChild(el('line', { x1: mLeft, y1: mTop, x2: mLeft, y2: mTop + chartH, stroke: '#555555', 'stroke-width': '1' }));
    svg.appendChild(el('line', { x1: mLeft + n * spacing, y1: mTop, x2: mLeft + n * spacing, y2: mTop + chartH, stroke: '#555555', 'stroke-width': '1' }));
    svg.appendChild(el('line', { x1: mLeft, y1: mTop + chartH, x2: mLeft + n * spacing, y2: mTop + chartH, stroke: '#555555', 'stroke-width': '1' }));

    // 折れ線
    function drawLine(vals, tickRange, color, labelOffsetY) {
        var points = vals.map(function(v, i) { return xPos(i) + ',' + scaleY(v, tickRange.min, tickRange.max); }).join(' ');
        svg.appendChild(el('polyline', { points: points, fill: 'none', stroke: color, 'stroke-width': '2' }));
        vals.forEach(function(v, i) {
            var cx = xPos(i), cy = scaleY(v, tickRange.min, tickRange.max);
            svg.appendChild(el('circle', { cx: cx, cy: cy, r: '4', fill: color }));
            svg.appendChild(el('text',   { x: cx, y: cy + labelOffsetY, 'text-anchor': 'middle', fill: color, 'font-size': '12' }, Number(v).toLocaleString()));
        });
    }

    drawLine(suuryouVals, sT, '#64b5f6', -8);
    drawLine(kijunVals,   kT, '#f06292',  16);
    drawLine(orderVals,   oT, '#a5d6a7',  30);

    // X軸ラベル（年変わりで年を表示）＋1万口あたり価格
    var prevYear = '';
    var rectW = 74, rectH = 18, rectRx = 5;
    sorted.forEach(function(r, i) {
        var tx       = xPos(i);
        var year     = r.order_date.slice(0, 4);
        var monthDay = r.order_date.slice(5);
        var perUnit    = (Number(r.kijun_price) / 10000).toFixed(4);
        var monthlyStr = Number(r.order_price).toLocaleString();

        // 目盛り線
        svg.appendChild(el('line', {
            x1: tx, y1: mTop + chartH, x2: tx, y2: mTop + chartH + 4,
            stroke: '#555555', 'stroke-width': '1'
        }));

        // 年ラベル（変わった時だけ）
        if (year !== prevYear) {
            svg.appendChild(el('text', {
                x: tx, y: mTop + chartH + 16,
                'text-anchor': 'middle', fill: '#cccccc', 'font-size': '12', 'font-weight': 'bold'
            }, year));
            prevYear = year;
        }

        // MM-DD
        svg.appendChild(el('text', {
            x: tx, y: mTop + chartH + 30,
            'text-anchor': 'middle', fill: '#888888', 'font-size': '12'
        }, monthDay));

        // 1口あたり 角丸長方形（基準価格ラインと同色）
        svg.appendChild(el('rect', {
            x: tx - rectW / 2, y: mTop + chartH + 36,
            width: rectW, height: rectH, rx: rectRx, ry: rectRx,
            fill: '#f06292'
        }));
        svg.appendChild(el('text', {
            x: tx, y: mTop + chartH + 49,
            'text-anchor': 'middle', fill: '#1a1a1a', 'font-size': '10', 'font-weight': 'bold'
        }, perUnit));

        // 月払い 角丸長方形（注文金額ラインと同色）
        svg.appendChild(el('rect', {
            x: tx - rectW / 2, y: mTop + chartH + 60,
            width: rectW, height: rectH, rx: rectRx, ry: rectRx,
            fill: '#a5d6a7'
        }));
        svg.appendChild(el('text', {
            x: tx, y: mTop + chartH + 73,
            'text-anchor': 'middle', fill: '#1a1a1a', 'font-size': '10', 'font-weight': 'bold'
        }, monthlyStr));
    });
}

function drawMiniChart(records, svg) {
    var sorted = groupByMonth(records);

    var n   = sorted.length;
    var w   = 120;
    var h   = 60;
    var pad = 4;

    svg.setAttribute('width',   w);
    svg.setAttribute('height',  h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '';

    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, text) {
        var e = document.createElementNS(NS, tag);
        Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function xAt(i) { return pad + (i / (n - 1 || 1)) * (w - pad * 2); }

    // 年ごとのデータを集計
    var yearData = {};
    sorted.forEach(function(r, i) {
        var year  = r.order_date.slice(0, 4);
        var month = r.order_date.slice(5, 7);
        if (!yearData[year]) yearData[year] = { months: {}, startIdx: i, endIdx: i };
        yearData[year].months[month] = true;
        yearData[year].endIdx = i;
    });

    // 年境界に縦線を引く
    var prevYear = '';
    var boundaries = []; // { x, prevYear }
    sorted.forEach(function(r, i) {
        var year = r.order_date.slice(0, 4);
        if (year !== prevYear && prevYear !== '') {
            var lx = xAt(i);
            svg.appendChild(el('line', { x1: lx, y1: 0, x2: lx, y2: h, stroke: '#666666', 'stroke-width': '1', 'stroke-dasharray': '2,2' }));
            boundaries.push({ x: lx, year: prevYear });
        }
        prevYear = year;
    });

    // 折れ線
    function miniLine(vals, color) {
        var mn = Math.min.apply(null, vals);
        var mx = Math.max.apply(null, vals);
        var points = vals.map(function(v, i) {
            return xAt(i) + ',' + ((h - pad) - ((v - mn) / ((mx - mn) || 1)) * (h - pad * 2));
        }).join(' ');
        svg.appendChild(el('polyline', { points: points, fill: 'none', stroke: color, 'stroke-width': '1.5', opacity: '0.9' }));
    }

    miniLine(sorted.map(function(r) { return Number(r.suuryou); }),     '#64b5f6');
    miniLine(sorted.map(function(r) { return Number(r.kijun_price); }), '#f06292');

    // 12ヶ月ある年だけ年ラベルを縦線間の中央に表示
    Object.keys(yearData).forEach(function(year) {
        var yd = yearData[year];
        if (Object.keys(yd.months).length < 12) return;
        var startX = xAt(yd.startIdx);
        var endX   = xAt(yd.endIdx);
        var cx     = (startX + endX) / 2;
        svg.appendChild(el('text', { x: cx, y: h / 2 + 4, 'text-anchor': 'middle', fill: '#999999', 'font-size': '9' }, year));
    });
}
