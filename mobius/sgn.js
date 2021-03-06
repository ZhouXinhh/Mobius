/**
 * Copyright (c) 2018, KETI
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @file
 * @copyright KETI Korea 2018, KETI
 * @author Il Yeup Ahn [iyahn@keti.re.kr]
 */

var util = require('util');
var url = require('url');
var http = require('http');
var https = require('https');
var coap = require('coap');
var js2xmlparser = require('js2xmlparser');
var xmlbuilder = require('xmlbuilder');
var fs = require('fs');
var db_sql = require('./sql_action');
var cbor = require("cbor");
var merge = require('merge');

var responder = require('./responder');

function make_xml_noti_message(pc, xm2mri, callback) {
    try {
        var noti_message = {};
        noti_message['m2m:rqp'] = {};
        noti_message['m2m:rqp'].op = 5; // notification
        //noti_message['m2m:rqp'].net = pc['m2m:sgn'].net;
        //noti_message['m2m:rqp'].to = pc['m2m:sgn'].sur;
        noti_message['m2m:rqp'].fr = usecseid;
        noti_message['m2m:rqp'].rqi = xm2mri;
        noti_message['m2m:rqp'].pc = pc;

        if(noti_message['m2m:rqp'].pc.hasOwnProperty('m2m:sgn')) {
            if(noti_message['m2m:rqp'].pc['m2m:sgn'].hasOwnProperty('nev')) {
                for(var prop in noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep) {
                    if (noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep.hasOwnProperty(prop)) {
                        for(var prop2 in noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop]) {
                            if (noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop].hasOwnProperty(prop2)) {
                                if(prop2 == 'rn') {
                                    noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop]['@'] = {rn : noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2]};
                                    delete noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2];
                                    break;
                                }
                                else {
                                    for (var prop3 in noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2]) {
                                        if (noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2].hasOwnProperty(prop3)) {
                                            if (prop3 == 'rn') {
                                                noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2]['@'] = {rn: noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2][prop3]};
                                                delete noti_message['m2m:rqp'].pc['m2m:sgn'].nev.rep[prop][prop2][prop3];
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        noti_message['m2m:rqp']['@'] = {
            "xmlns:m2m": "http://www.onem2m.org/xml/protocols",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
        };

        var xmlString = js2xmlparser.parse("m2m:rqp", noti_message['m2m:rqp']);

        callback(xmlString);
    }
    catch (e) {
        console.log('[make_xml_noti_message] xml parsing error');
        callback(e.message);
        return "";
    }
}

function make_cbor_noti_message(pc, xm2mri) {
    try {
        var noti_message = {};
        noti_message['m2m:rqp'] = {};
        noti_message['m2m:rqp'].op = 5; // notification
        //noti_message['m2m:rqp'].net = pc['m2m:sgn'].net;
        //noti_message['m2m:rqp'].to = pc['m2m:sgn'].sur;
        noti_message['m2m:rqp'].fr = usecseid;
        noti_message['m2m:rqp'].rqi = xm2mri;

        noti_message['m2m:rqp'].pc = pc;

        return cbor.encode(noti_message['m2m:rqp']).toString('hex');
    }
    catch (e) {
        console.log('[make_cbor_noti_message] cbor parsing error');
    }
}

function make_json_noti_message(nu, pc, xm2mri, short_flag) {
    try {
        var noti_message = {};
        noti_message['m2m:rqp'] = {};
        noti_message['m2m:rqp'].op = 5; // notification
        noti_message['m2m:rqp'].rqi = xm2mri;

        if(short_flag == 1) {

        }
        else {
            //noti_message['m2m:rqp'].net = pc['m2m:sgn'].net;
            noti_message['m2m:rqp'].to = nu;
            noti_message['m2m:rqp'].fr = usecseid;
        }

        noti_message['m2m:rqp'].pc = pc;

        return JSON.stringify(noti_message['m2m:rqp']);
    }
    catch (e) {
        console.log('[make_json_noti_message] json parsing error');
    }
}

function make_body_string_for_noti(protocol, nu, node, sub_bodytype, xm2mri, short_flag, callback) {
    if (sub_bodytype == 'xml') {
        if (protocol == 'http:' || protocol == 'https:' || protocol == 'coap:') {
            try {
                var bodyString = responder.convertXmlSgn(Object.keys(node)[0], node[Object.keys(node)[0]]);
            }
            catch (e) {
                bodyString = "";
            }
            callback(bodyString);
        }
        else if (protocol == 'ws:' || protocol == 'mqtt:') {
            make_xml_noti_message(node, xm2mri, function (bodyString) {
                callback(bodyString);
            });

        }
        else {
            callback('');
        }
    }
    else if (sub_bodytype == 'cbor') {
        if (protocol == 'http:' || protocol == 'https:' || protocol == 'coap:') {
            bodyString = cbor.encode(node).toString('hex');
            callback(bodyString);
        }
        else if (protocol == 'ws:' || protocol == 'mqtt:') {
            bodyString = make_cbor_noti_message(node, xm2mri);
            callback(bodyString);
        }
        else {
            callback('');
        }
    }
    else { // defaultbodytype == 'json')
        if (protocol == 'http:' || protocol == 'https:' || protocol == 'coap:') {
            bodyString = JSON.stringify(node);
            callback(bodyString);
        }
        else if (protocol == 'ws:' || protocol == 'mqtt:') {
            bodyString = make_json_noti_message(nu, node, xm2mri, short_flag);
            callback(bodyString);
        }
        else {
            callback('');
        }
    }
}

function sgn_action_send(nu, sub_nu, sub_bodytype, node, short_flag, check_value, ss_cr, ss_ri, xm2mri, exc) {
    if (sub_nu.query != null) {
        var sub_nu_query_arr = sub_nu.query.split('&');
        for (var prop in sub_nu_query_arr) {
            if (sub_nu_query_arr.hasOwnProperty(prop)) {
                if (sub_nu_query_arr[prop].split('=')[0] == 'ct') {
                    if (sub_nu_query_arr[prop].split('=')[1] == 'xml') {
                        sub_bodytype = 'xml';
                    }
                    else {
                        sub_bodytype = 'json';
                    }
                }
                else if (sub_nu_query_arr[prop].split('=')[0] == 'rcn') {
                    if (sub_nu_query_arr[prop].split('=')[1] == '9') {
                        for (var index in node['m2m:sgn'].nev.rep) {
                            if (node['m2m:sgn'].nev.rep.hasOwnProperty(index)) {
                                if (node['m2m:sgn'].nev.rep[index].cr) {
                                    delete node['m2m:sgn'].nev.rep[index].cr;
                                }

                                if (node['m2m:sgn'].nev.rep[index].st) {
                                    delete node['m2m:sgn'].nev.rep[index].st;
                                }

                                delete node['m2m:sgn'].nev.rep[index].ct;
                                delete node['m2m:sgn'].nev.rep[index].lt;
                                delete node['m2m:sgn'].nev.rep[index].et;
                                delete node['m2m:sgn'].nev.rep[index].ri;
                                delete node['m2m:sgn'].nev.rep[index].pi;
                                delete node['m2m:sgn'].nev.rep[index].rn;
                                delete node['m2m:sgn'].nev.rep[index].ty;
                                delete node['m2m:sgn'].nev.rep[index].fr;

                                short_flag = 1;
                            }
                        }
                    }
                }
            }
        }
    }

    if(check_value == 128) {
        node['m2m:sgn'].sud = true;
        delete node['m2m:sgn'].nev;
    }
    else if(check_value == 256) {
        node['m2m:sgn'].vrq = true;
        temp = node['m2m:sgn'].sur;
        delete node['m2m:sgn'].sur;
        node['m2m:sgn'].sur = temp;
        node['m2m:sgn'].cr = ss_cr;
        delete node['m2m:sgn'].nev;
    }
    node['m2m:sgn'].rvi = uservi;

    make_body_string_for_noti(sub_nu.protocol, nu, node, sub_bodytype, xm2mri, short_flag, function (bodyString) {
        if (bodyString == "") { // parse error
            console.log('can not send notification since error of converting json to xml');
        }
        else {
            request_noti(nu, ss_ri, bodyString, sub_bodytype, xm2mri, exc);
        }
    });
}

function sgn_action(rootnm, check_value, results_ss, noti_Obj, sub_bodytype) {
    var notiObj = merge({}, noti_Obj);

    var nct = results_ss.nct;
    var enc_Obj = results_ss.enc;
    var net_arr = enc_Obj.net;

    for (var j = 0; j < net_arr.length; j++) {
        /* for testing, make comment statement
        if (net_arr[j] == check_value) { // 1 : Update_of_Subscribed_Resource, 3 : Create_of_Direct_Child_Resource, 4 : Delete_of_Direct_Child_Resource
         */
        if (net_arr[j] == check_value || check_value == 256 || check_value == 128) { // 1 : Update_of_Subscribed_Resource, 3 : Create_of_Direct_Child_Resource, 4 : Delete_of_Direct_Child_Resource
            var nu_arr = results_ss.nu;
            for (var k = 0; k < nu_arr.length; k++) {
                var nu = nu_arr[k];

                var node = {};
                node['m2m:sgn'] = {};

                if(results_ss.ri.charAt(0) == '/') {
                    node['m2m:sgn'].sur = results_ss.ri.replace('/', '');
                }
                else {
                    node['m2m:sgn'].sur = results_ss.ri;
                }

                if (results_ss.nec) {
                    node['m2m:sgn'].nec = results_ss.nec;
                }
                node['m2m:sgn'].nev = {};
                node['m2m:sgn'].nev.net = parseInt(net_arr[j].toString());
                node['m2m:sgn'].nev.rep = {};
                node['m2m:sgn'].nev.rep['m2m:' + rootnm] = notiObj;

                responder.typeCheckforJson(node['m2m:sgn'].nev.rep);

                var xm2mri = require('shortid').generate();
                var short_flag = 0;

                var sub_nu = url.parse(nu);

                if(sub_nu.protocol == null) { // ID format
                    var absolute_url = nu;
                    absolute_url = absolute_url.replace(usespid + usecseid + '/', '/');
                    absolute_url = absolute_url.replace(usecseid + '/', '/');

                    if(absolute_url.charAt(0) != '/') {
                        absolute_url = '/' + absolute_url;
                    }

                    var absolute_url_arr = absolute_url.split('/');

                    db_sql.get_ri_sri(node, absolute_url, absolute_url_arr[1].split('?')[0], function (err, results, node, absolute_url) {
                        if (err) {
                            console.log('[sgn_action] database error (can not get resourceID from database)');
                        }
                        else {
                            absolute_url = (results.length == 0) ? absolute_url : ((results[0].hasOwnProperty('ri')) ? absolute_url.replace('/' + absolute_url_arr[1], results[0].ri) : absolute_url);

                            var sri = absolute_url_arr[1].split('?')[0];
                            var ri = absolute_url.split('?')[0];
                            db_sql.select_resource_from_url(ri, sri, function (err, result_Obj) {
                                if (!err) {
                                    if (result_Obj.length == 1) {
                                        if (result_Obj[0].poa != null || result_Obj[0].poa != '') {
                                            var poa_arr = JSON.parse(result_Obj[0].poa);
                                            for (var i = 0; i < poa_arr.length; i++) {
                                                sub_nu = url.parse(poa_arr[i]);
                                                if(sub_nu.protocol == null) {
                                                    nu = 'http://localhost:7579' + absolute_url;
                                                    sub_nu = url.parse(nu);
                                                    if (nct == 2 || nct == 1) {
                                                        sgn_action_send(nu, sub_nu, sub_bodytype, node, short_flag, check_value, results_ss.cr, results_ss.ri, xm2mri, results_ss.exc);
                                                    }
                                                }
                                                else {
                                                    nu = poa_arr[i];
                                                    if (nct == 2 || nct == 1) {
                                                        sgn_action_send(nu, sub_nu, sub_bodytype, node, short_flag, check_value, results_ss.cr, results_ss.ri, xm2mri, results_ss.exc);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                else {
                                    console.log('[sgn_action] database error (nu resource)');
                                }
                            });
                        }
                    });
                }
                else { // url format
                    if (nct == 2 || nct == 1) {
                        sgn_action_send(nu, sub_nu, sub_bodytype, node, short_flag, check_value, results_ss.cr, results_ss.ri, xm2mri, results_ss.exc);
                    }
                    else {
                        console.log('nct except 2 (All Attribute) do not support');
                    }
                }
            }
        }
        //else {
        //    console.log('enc-net except 3 do not support');
        //}
    }
}

exports.check = function(request, notiObj, check_value) {
    var rootnm = request.headers.rootnm;

    if((request.method == "PUT" && check_value == 1)) {
        var pi = notiObj.ri;
    }
    else if ((request.method == "POST" && check_value == 3) || (request.method == "DELETE" && check_value == 4)) {
        pi = notiObj.pi;
    }

    var ri = notiObj.ri;

    var noti_Str = JSON.stringify(notiObj);
    var noti_Obj = JSON.parse(noti_Str);

    if (request.query.real == 4) {
        // for test of measuring elapsed time of processing in mobius
        // var hrend = process.hrtime(elapsed_hrstart[request.headers.elapsed_tid]);
        // var elapsed_hr_str = util.format(require('moment')().utc().format('YYYYMMDDTHHmmss') + "(hr): %ds %dms\r\n", hrend[0], hrend[1]/1000000);
        // console.info(elapsed_hr_str);
        // console.timeEnd(request.headers.elapsed_tid);
        // var fs = require('fs');
        // fs.appendFileSync('get_elapsed_time.log', elapsed_hr_str, 'utf-8');
        // delete elapsed_hrstart[request.headers.elapsed_tid];
        if(request.query.hasOwnProperty('nu')) {
            var results_ss = {};
            results_ss.ri = pi + '/' + (request.query.hasOwnProperty('rn') ? request.query.rn : 'sub');
            results_ss.nct = '2';
            results_ss.enc = {};
            results_ss.enc.net = [];
            results_ss.enc.net.push('3');
            results_ss.nu = [];
            results_ss.nu.push((request.query.hasOwnProperty('nu') ? request.query.nu : 'http://localhost'));
            sgn_action(rootnm, check_value, results_ss, noti_Obj, request.headers.usebodytype);
        }
        return'1';
    }

    if(check_value == 256 || check_value == 128) { // verification
        sgn_action(rootnm, check_value, notiObj, noti_Obj, request.headers.usebodytype);
    }
    else {
        var noti_ri = noti_Obj.ri;
        noti_Obj.ri = noti_Obj.sri;
        delete noti_Obj.sri;
        noti_Obj.pi = noti_Obj.spi;
        delete noti_Obj.spi;

        var subl = request.targetObject[Object.keys(request.targetObject)[0]].subl;
        for (var i = 0; i < subl.length; i++) {
            if(subl[i].ri == noti_ri) {
                continue;
            }

            console.log('send sgn ' + i);
            sgn_action(rootnm, check_value, subl[i], noti_Obj, request.headers.usebodytype);
        }
    }
};

function request_noti(nu, ri, bodyString, bodytype, xm2mri, exc) {
    var options = {
        hostname: 'localhost',
        port: use_sgn_man_port,
        path: '/sgn',
        method: 'POST',
        headers: {
            'X-M2M-RI': xm2mri,
            'Accept': 'application/'+bodytype,
            'X-M2M-Origin': usecseid,
            'Content-Type': 'application/' + bodytype,
            'Content-Length' : bodyString.length,
            'X-M2M-RVI': uservi,
            'nu': nu,
            'bodytype': bodytype,
            'ri': ri,
            'exc': exc
        }
    };

    var bodyStr = '';
    if (use_secure == 'disable') {
        var req = http.request(options, function (res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                bodyStr += chunk;
            });

            res.on('end', function () {
                if(res.statusCode == 200 || res.statusCode == 201) {
                    console.log('-------> [response_noti - ' + res.headers['x-m2m-rsc'] + '] - ' + ri);
                }
            });
        });
    }
    else {
        options.ca = fs.readFileSync('ca-crt.pem');

        req = https.request(options, function (res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                bodyStr += chunk;
            });

            res.on('end', function () {
                if(res.statusCode == 200 || res.statusCode == 201) {
                    console.log('-------> [response_noti - ' + res.headers['x-m2m-rsc'] + '] - ' + ri);
                }
            });
        });
    }

    req.on('error', function (e) {
        if(e.message != 'read ECONNRESET') {
            //console.log('--xxx--> [request_noti - problem with request: ' + e.message + ']');
            console.log('--xxx--> [request_noti - no response - ' + ri + ']');
        }
    });

    req.on('close', function () {
        //console.log('--xxx--> [request_noti - close: no response for notification');
    });

    req.write(bodyString);
    req.end();
}
