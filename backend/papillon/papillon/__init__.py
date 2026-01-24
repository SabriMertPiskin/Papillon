import pymysql
pymysql.install_as_MySQLdb()

# Override version check for PyMySQL compatibility with Django
pymysql.version_info = (2, 2, 4, "final", 0)