const editBkModal = iBk => {
    console.log(iBk, bkData.bkCheckSpecial[iBk]);
    $(`#editBkModalHeader`).text(`Edit: ${iBk}`);
    $(`#editBkModal input[name="id"]`).val(iBk);
    const type = iBk === 'extension' ? 'ONE' : bkData.bkAutoload[iBk] ? 'THREE' : 'TWO';
    $(`#editBkModal div[data-type~="${type}"] input[type="text"]`).each(function () {
        const field = $(this).attr('name');
        const val = bkData[field] && bkData[field][iBk] ? bkData[field][iBk] : '';
        $(this).val(typeof val === 'object' && Array.isArray(val) ? val.join('; ') : val);
    });
    switchMode(iBk);
    if (type === 'TWO') {
        $(`#bkAllFrames`).attr('checked', !!bkData.bkAllFrames[iBk]);
    } else if (type === 'THREE') {
        $(`#bkCheckSpecial`).attr('checked', !!bkData.bkCheckSpecial[iBk]);
    }
    $(`#editBkModal`).modal(`show`);
};

const saveBkModal = () => {
    const iBk = $(`#editBkModalId`).val();
    const type = iBk === 'extension' ? 'ONE' : bkData.bkAutoload[iBk] ? 'THREE' : 'TWO';
    const data = {};
    $(`#editBkModal input[type="text"].native:visible`).each(function () {
        data[$(this).attr(`name`)] = $(this).val();
    });
    if (type === 'TWO') {
        data[`bkAutoload`] = false;
        data[`bkAllFrames`] = $(`#bkAllFrames`).is(`:checked`);
    } else if (type === 'THREE') {
        data[`bkAutoload`] = true;
        data[`bkCheckSpecial`] = $(`#bkCheckSpecial`).is(`:checked`);
        const rules = $('#bkAutoCheck').queryBuilder('getRules');
        data[`bkAutoCheck`] = rules ? JSON.stringify(rules) : null;
    }
    $.ajax({
        type: "POST",
        url: `${bkModalSaveUrl}?internalName=${iBk}`,
        data: data,
        dataType: "json",
        success: function (data) {
            console.log(data);
            window.location.reload();
        }
    }).always(() => {
        window.location.reload();
    });
};

const switchMode = iBk => {
    const type = iBk === 'extension' ? 'ONE' : bkData.bkAutoload[iBk] ? 'THREE' : 'TWO';
    $(`#editBkModal div[data-field]`).hide();
    $(`#editBkModal div[data-type~="${type}"]`).show();
    if (type === 'THREE') {
        $('#bkAutoload_Autoload').attr('checked', true);
        $('#bkAutoCheck').queryBuilder({
            filters: [
                {
                    id: 'title',
                    label: 'Title',
                    type: 'string',
                    operators: ['contains']
                },
                {
                    id: 'href',
                    label: 'Href',
                    type: 'string',
                    operators: ['contains']
                },
            ]
        });
        if (bkData.bkAutoCheck[iBk] && bkData.bkAutoCheck[iBk] !== '') {
            $('#bkAutoCheck').queryBuilder('setRules', JSON.parse(bkData.bkAutoCheck[iBk]));
        } else {
            $('#bkAutoCheck').queryBuilder('reset');
        }
    } else if (type === 'TWO') {
        $('#bkAutoload_Ordinary').attr('checked', true);
    }
};

$(`#bkAutoload_Ordinary, #bkAutoload_Autoload`).click(function () {
    if ($(`#editBkModal`).is(':visible')) {
        const iBk = $(`#editBkModal input[name="id"]`).val();
        bkData.bkAutoload[iBk] = $(`#bkAutoload_Autoload`).is(':checked');
        switchMode(iBk);
    }
});

$(`a[data-ibk]`).click(function () {
    editBkModal($(this).attr(`data-ibk`));
});

$('#saveBkModal').click(saveBkModal);
$('#addNewBkModal').click(() => {
    const iBk = $('#addNewName').val();
    if (iBk.length < 3) {
        return;
    }
    $('#addNewName').val('');
    bkData.bkAutoload[iBk] = false;
    editBkModal(iBk);
});