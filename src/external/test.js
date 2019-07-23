module.exports = function(id, value) {
    var self = this;
    var init = {
        start: function() {
            self.value = value;
        }
    }

    this.echo = function(){
        console.log(self.value);
    }
}