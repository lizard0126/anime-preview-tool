const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.join(__dirname, '..')
const AVATAR_DIR = path.join(ROOT_DIR, 'output', 'assets', 'avatar')

const COPY_REGEX = /【(金牌|银牌|黑牌)】/

function deleteAvatarCopies() {
  const files = fs.readdirSync(AVATAR_DIR)

  files.forEach((file) => {
    if (COPY_REGEX.test(file)) {
      const filePath = path.join(AVATAR_DIR, file)
      fs.unlinkSync(filePath)
    }
  })
  console.log(`删除头像文件`)
}

deleteAvatarCopies()