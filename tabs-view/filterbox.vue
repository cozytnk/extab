<template>
<div class="filterbox" :class="{ 'regexp-error': regExpAndError.error }" :title="regExpErrorMessage">

  <input type="text" :placeholder="placeholder" :value="text" @keyup="$emit('update:text', $event.target.value)">
  <label>
    <input type="checkbox" :checked="usesRegExp" @change="$emit('update:usesRegExp', $event.target.checked)">
    <i v-show=" usesRegExp" class="material-icons">code    </i>
    <i v-show="!usesRegExp" class="material-icons">code_off</i>
  </label>

</div>
</template>


<script>
module.exports = {
  props: [ 'text', 'usesRegExp', 'placeholder' ],
  data () {
    return {
    }
  },
  computed: {
    regExpAndError () {
      if (this.usesRegExp) {
        try {
          const regExp =new RegExp(this.text, 'i')
          return { regExp, error: null }
        } catch (error) {
          return { regExp: null, error }
        }
      } else {
        return { regExp: null, error: null }
      }
    },
    regExpErrorMessage () {
      const error = this.regExpAndError.error
      return error ? `${error.name}\n${error.message}` : null
    },
  },
  methods: {
    test (value) {
      if (this.usesRegExp) {
        const { regExp } = this.regExpAndError
        if (!regExp) return true
        return regExp.test(value)
      } else {
        return value.toLowerCase().includes(this.text.toLowerCase())
      }
    },
  },
}
</script>


<style scoped>
.filterbox {
  --height: 28px;
  height: var(--height);
  position: relative;
}

input[type=text] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: none;
  padding-right: 28px;
}

label {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--height);
  height: var(--height);
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
}
label > input[type=checkbox] {
  display: none;
}
label > i {
  font-size: 16px;
  color: #666;
}

.regexp-error input,
.regexp-error i {
  color: red;
}
</style>