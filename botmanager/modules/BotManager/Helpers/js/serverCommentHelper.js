$(document).ready(function () {

    $('input.serverComment, textarea.serverComment').on('change', function () {
        const $this = $(this);
        if ($this.val() === $this.data('value')) {
            return;
        }
        if (!urlToBotSave) {
            alert('No urlToBotSave!');
            return;
        }
        $.post(urlToBotSave, {
            id: $this.data('id'),
            field: $this.attr('name'),
            value: $this.val()
        }, function (d) {
            if (d && d.status && d.status === 'success') {
                $this.css('background', 'green');
                setTimeout(function () {
                    $this.css('background', 'transparent');
                }, 1000);
            } else {
                alert('Error save!\n' + (d.message || ''));
            }
        }, 'JSON').fail(function () {
            alert("error urlToBotSave!");
        });
    });

});