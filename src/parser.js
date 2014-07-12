Fb2Parser = function() {
    var Book        = '',
        nameSpace   = {
            fb : 'http://www.gribuser.ru/xml/fictionbook/2.0'
        };

    function load(document) {
        Book = require('libxmljs').parseXmlString(document);
    }

    function title() {
        return Book.get('//fb:book-title', nameSpace).text();
    }

    function author() {
        return Book.get('//fb:first-name', nameSpace).text() + ' ' + Book.get('//fb:last-name', nameSpace).text();
    }

    function date() {
        return Book.get('//fb:date', nameSpace).text();
    }

    function content() {
        var chapters = [];

        Book.find('//fb:body[1]/fb:section', nameSpace).forEach(function(section) {
            var title = section.get('fb:title/fb:p', nameSpace).text();
            var content = '';

            section.childNodes().forEach(function(child) {
                if (child.name() != 'title') {
                    content += child.toString();
                }
            });

            var chapter = {
                title : title,
                content : content
            }
            chapters.push(chapter);
        })

        return chapters;
    }

    function css() {
        return '';
    }

    function notes() {
        return [];
    }

    function images() {
        return [];
    }

    function cover() {
        return [];
    }

    function finalize() {
        return Book;
    }

    return {
        load : load,
        title : title,
        author : author,
        date : date,
        css : css,
        content : content,
        notes : notes,
        images : images,
        cover : cover,
        finalize : finalize
    }
}

module.exports = Fb2Parser;