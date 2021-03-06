'use strict';

var logger = require('logger');
var simpleSqlParser = require('simple-sql-parser');
// var JSONAPISerializer = require('jsonapi-serializer').Serializer;
// var csvSerializer = new JSONAPISerializer('csv', {
// attributes: ['geojson', 'hash', 'providers'],
// geojson:{
//     attributes:['type', 'features', 'crs']
// },
// providers:{
//     attributes: ['provider', 'table', 'user']
// },
// typeForAttribute: function (attribute, record) {
//     return attribute;
// }
// });

class CSVSerializer {

    static serializeBucket(key, buckets) {
        let values = [];

        buckets.map((el) => {
            let value = el.key;

            if (Object.keys(el).length > 2) {
                let newKey = null;
                let keys = Object.keys(el);
                newKey = keys.filter((key) => (key!== 'key' && key !== 'doc_count'));

                if(el[newKey].buckets){

                    let childs = CSVSerializer.serializeBucket(newKey, el[newKey].buckets);

                    childs.map((child) => {
                        child[key] = value;
                    });
                    values = values.concat(childs);
                }else{
                    let obj = {};
                    obj[key] = value;
                    obj[newKey] = el[newKey].value;
                    values.push(obj);
                }
            }
        });
        return values;
    }

    static obtainASTFromSQL(sql){

        let ast = simpleSqlParser.sql2ast(sql);
        if (!ast.status){
            return {
                error: true,
                ast: null
            };
        }
        return {
            error: false,
            ast: ast.value
        };
    }

    static formatAlias(el, aliases){
        if(aliases && el){
            for(let i = 0, length = aliases.length; i < length; i++){
                if(aliases[i].alias && aliases[i].alias!== null) {
                    el[aliases[i].alias] = el[aliases[i].column];
                    delete el[aliases[i].column];
                }
            }
        }
        return el;
    }

    static serialize(data, sql, id) {
        let ast = null;
        if(sql){
            let result = CSVSerializer.obtainASTFromSQL(sql);
            if(!result.error){
                ast = result.ast.select;
            }else {
                logger.warn('Error parsing sql');
            }
        }
        if (data && data.length > 0) {

            if (data[0].hits && data[0].hits.hits && data[0].hits.hits.length > 0) {
                // return {
                //     data: {
                //         id: id,
                //         type: 'csv',
                //         attributes: {
                //             rows:data[0].hits.hits.map((el) => CSVSerializer.formatAlias(el._source, ast))
                //         }
                //     }
                // };
                return {
                    data: data[0].hits.hits.map((el) => CSVSerializer.formatAlias(el._source, ast))
                };
            } else if (data[0].aggregations) {

                let keys = Object.keys(data[0].aggregations);
                let attributes = {};
                if (!data[0].aggregations[keys[0]].buckets) {
                    attributes[keys[0]] = data[0].aggregations[keys[0]].value;
                    // return {
                    //     data: {
                    //         id: id,
                    //         type: 'csv',
                    //         attributes: {
                    //             rows: [attributes]
                    //         }
                    //     }
                    // };
                    return {
                        data: [attributes]
                    };
                } else {
                    return {
                        data: CSVSerializer.serializeBucket(keys[0], data[0].aggregations[keys[0]].buckets)
                    };
                    // return {
                    //     data:{
                    //         id: id,
                    //         type: 'csv',
                    //         attributes: {
                    //             rows: CSVSerializer.serializeBucket(keys[0], data[0].aggregations[keys[0]].buckets)
                    //         }
                    //     }
                    // };
                }

            }
        }
        return {
            data: []
        };

    }
}

module.exports = CSVSerializer;
