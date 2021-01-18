$(".label-page-btn").click((e)=>{
    let targ = e.target || e.srcElement;
    $(".label-page-main").addClass("d-none")
    $("#"+$(targ)[0].id+"-main").removeClass("d-none");
})